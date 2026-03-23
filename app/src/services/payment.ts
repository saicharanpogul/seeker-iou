/**
 * Payment service — the core offline payment flow.
 * Handles IOU creation, signing, NFC sending/receiving, and settlement.
 */

import { PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  createIOUMessage,
  parseIOUMessage,
  trackIssuedIOU,
  getLocalAvailableBalance,
  serializeLocalState,
  deserializeLocalState,
  createSettleIOUInstruction,
  chunkSettlementTransactions,
  resolveRecipientDisplay,
  type LocalVaultState,
  type PendingIOU,
  type ReceivedIOU,
  type IOUParams,
} from "seeker-iou";
import { connection, signMessage } from "./wallet";
import { sendIOUViaNFC, receiveIOUViaNFC } from "./nfc";

/**
 * Create and send an IOU payment via NFC tap.
 * Called when the user taps "Pay" and holds phone against recipient.
 */
export async function sendPayment(params: {
  localState: LocalVaultState;
  recipient: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;
  sgtMint: PublicKey;
  memo?: string;
}): Promise<{
  updatedState: LocalVaultState;
  iou: PendingIOU;
}> {
  const vault = new PublicKey(params.localState.vaultAddress);
  const sender = new PublicKey(params.localState.vaultAddress); // vault owner

  // Check local balance
  const available = getLocalAvailableBalance(params.localState);
  if (available < params.amount) {
    throw new Error(
      `Insufficient balance: ${available} available, ${params.amount} requested`
    );
  }

  const nextNonce = params.localState.currentNonce + 1;

  // Create IOU message
  const message = createIOUMessage({
    vault,
    sender,
    recipient: params.recipient,
    tokenMint: params.tokenMint,
    amount: params.amount,
    nonce: nextNonce,
    sgtMint: params.sgtMint,
    memo: params.memo,
  });

  // Sign with Seed Vault (hardware)
  const signature = await signMessage(message);

  // Send via NFC
  const result = await sendIOUViaNFC(message, signature);
  if (!result.success) {
    throw new Error(`NFC send failed: ${result.error}`);
  }

  // Track locally
  const iou: PendingIOU = {
    recipient: params.recipient.toBase58(),
    amount: params.amount,
    nonce: nextNonce,
    message,
    signature,
    createdAt: Date.now(),
    settled: false,
  };

  const updatedState = trackIssuedIOU(params.localState, iou);

  return { updatedState, iou };
}

/**
 * Receive an IOU payment via NFC tap.
 * Called when the app detects an incoming NFC tag.
 */
export async function receivePayment(): Promise<ReceivedIOU | null> {
  const result = await receiveIOUViaNFC();

  if (!result.success || !result.iou || !result.signature) {
    return null;
  }

  // Resolve .skr domain for display
  let senderDisplay: string;
  try {
    const domain = await resolveRecipientDisplay(
      connection,
      result.iou.sender
    );
    senderDisplay = domain || result.iou.sender.toBase58();
  } catch {
    senderDisplay = result.iou.sender.toBase58();
  }

  const received: ReceivedIOU = {
    sender: result.iou.sender.toBase58(),
    senderSgtMint: result.iou.sgtMint.toBase58(),
    amount: result.iou.amount,
    nonce: result.iou.nonce,
    message: result.signature, // raw NFC bytes
    signature: result.signature,
    receivedAt: Date.now(),
    settled: false,
    settlementTx: null,
  };

  return received;
}

/**
 * Settle collected IOUs when back online.
 * Batches IOUs into transactions and submits them.
 */
export async function settleIOUs(params: {
  settler: PublicKey;
  receivedIOUs: ReceivedIOU[];
}): Promise<{ settled: number; failed: number; txSignatures: string[] }> {
  const txSignatures: string[] = [];
  let settled = 0;
  let failed = 0;

  for (const iou of params.receivedIOUs) {
    if (iou.settled) continue;

    try {
      const parsed = parseIOUMessage(iou.message);

      const instructions = await createSettleIOUInstruction({
        settler: params.settler,
        vault: parsed.vault,
        recipient: parsed.recipient,
        tokenMint: parsed.tokenMint,
        iouMessage: iou.message,
        signature: iou.signature,
        nonce: parsed.nonce,
        sgtMint: parsed.sgtMint,
        senderPublicKey: parsed.sender,
      });

      const tx = new Transaction();
      for (const ix of instructions) {
        tx.add(ix);
      }
      tx.feePayer = params.settler;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendAndConfirmTransaction(connection, tx, []);
      txSignatures.push(sig);
      iou.settled = true;
      iou.settlementTx = sig;
      settled++;
    } catch (err) {
      console.error(`Failed to settle IOU nonce=${iou.nonce}:`, err);
      failed++;
    }
  }

  return { settled, failed, txSignatures };
}
