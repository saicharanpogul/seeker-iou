import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  Ed25519Program,
  SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { deriveSettlementRecordPda, deriveReputationPda } from "./utils";

function getProgram(): Program {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const idl = require("../idl/seeker_iou.json");
  return new Program(idl);
}

/**
 * Create settlement instructions for a single IOU.
 * Returns TWO instructions: Ed25519 verify + settle_iou.
 * Both must be included in the same transaction, Ed25519 first.
 */
export async function createSettleIOUInstruction(params: {
  settler: PublicKey;
  vault: PublicKey;
  recipient: PublicKey;
  tokenMint: PublicKey;
  iouMessage: Uint8Array;
  signature: Uint8Array;
  nonce: number;
  sgtMint: PublicKey;
  senderPublicKey: PublicKey;
}): Promise<TransactionInstruction[]> {
  // Ed25519 verify instruction
  const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
    publicKey: params.senderPublicKey.toBytes(),
    message: params.iouMessage,
    signature: params.signature,
  });

  // settle_iou instruction
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    params.tokenMint,
    params.vault,
    true
  );
  const recipientTokenAccount = getAssociatedTokenAddressSync(
    params.tokenMint,
    params.recipient
  );
  const [settlementRecordPda] = deriveSettlementRecordPda(
    params.vault,
    params.nonce
  );
  const [reputationPda] = deriveReputationPda(params.sgtMint);

  const program = getProgram();
  const settleIx = await program.methods
    .settleIou(
      Buffer.from(params.iouMessage),
      Array.from(params.signature),
      params.nonce
    )
    .accountsStrict({
      settler: params.settler,
      vault: params.vault,
      tokenMint: params.tokenMint,
      vaultTokenAccount,
      recipient: params.recipient,
      recipientTokenAccount,
      settlementRecord: settlementRecordPda,
      reputation: reputationPda,
      instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction();

  return [ed25519Ix, settleIx];
}

/**
 * Create batch settlement instructions for multiple IOUs.
 * Returns pairs of [Ed25519 verify, settle_iou] for each IOU.
 */
export async function createBatchSettleInstructions(params: {
  settler: PublicKey;
  ious: Array<{
    vault: PublicKey;
    recipient: PublicKey;
    tokenMint: PublicKey;
    iouMessage: Uint8Array;
    signature: Uint8Array;
    nonce: number;
    sgtMint: PublicKey;
    senderPublicKey: PublicKey;
  }>;
}): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];

  for (const iou of params.ious) {
    const pair = await createSettleIOUInstruction({
      settler: params.settler,
      ...iou,
    });
    instructions.push(...pair);
  }

  return instructions;
}

/**
 * Split settlement instructions into transaction-sized batches.
 * A Solana transaction has a ~1232 byte limit. Each IOU settlement pair
 * is roughly 500 bytes, so we can fit ~2 per transaction.
 */
export function chunkSettlementTransactions(
  instructions: TransactionInstruction[],
  feePayer: PublicKey
): Transaction[] {
  const transactions: Transaction[] = [];

  // Instructions come in pairs: [ed25519, settle, ed25519, settle, ...]
  const PAIRS_PER_TX = 2;
  const INSTRUCTIONS_PER_PAIR = 2;

  for (let i = 0; i < instructions.length; i += PAIRS_PER_TX * INSTRUCTIONS_PER_PAIR) {
    const tx = new Transaction();
    tx.feePayer = feePayer;

    const end = Math.min(
      i + PAIRS_PER_TX * INSTRUCTIONS_PER_PAIR,
      instructions.length
    );
    for (let j = i; j < end; j++) {
      tx.add(instructions[j]);
    }

    transactions.push(tx);
  }

  return transactions;
}
