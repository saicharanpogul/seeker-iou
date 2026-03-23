import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SeekerIou } from "../target/types/seeker_iou";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Ed25519Program,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  setAuthority,
} from "@solana/spl-token";
import { BorshSchema, borshSerialize } from "borsher";

const SGT_MINT_AUTHORITY = new PublicKey(
  "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4"
);

const IOUMessageSchema = BorshSchema.Struct({
  version: BorshSchema.u8,
  vault: BorshSchema.Array(BorshSchema.u8, 32),
  sender: BorshSchema.Array(BorshSchema.u8, 32),
  recipient: BorshSchema.Array(BorshSchema.u8, 32),
  token_mint: BorshSchema.Array(BorshSchema.u8, 32),
  amount: BorshSchema.u64,
  nonce: BorshSchema.u64,
  expiry: BorshSchema.i64,
  sgt_mint: BorshSchema.Array(BorshSchema.u8, 32),
  memo: BorshSchema.Array(BorshSchema.u8, 32),
});

function createIOUMessageBytes(params: {
  vault: PublicKey;
  sender: PublicKey;
  recipient: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;
  nonce: bigint;
  expiry: bigint;
  sgtMint: PublicKey;
}): Buffer {
  const data = {
    version: 1,
    vault: Array.from(params.vault.toBytes()),
    sender: Array.from(params.sender.toBytes()),
    recipient: Array.from(params.recipient.toBytes()),
    token_mint: Array.from(params.tokenMint.toBytes()),
    amount: params.amount,
    nonce: params.nonce,
    expiry: params.expiry,
    sgt_mint: Array.from(params.sgtMint.toBytes()),
    memo: Array.from(Buffer.alloc(32)),
  };
  return Buffer.from(borshSerialize(IOUMessageSchema, data));
}

function nonceToLeBytes(nonce: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(nonce);
  return buf;
}

async function getComputeUnits(
  connection: anchor.web3.Connection,
  txSig: string
): Promise<number | null> {
  const tx = await connection.getTransaction(txSig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.meta) return null;
  // computeUnitsConsumed is the total for the entire transaction
  if (tx.meta.computeUnitsConsumed != null) {
    return tx.meta.computeUnitsConsumed;
  }
  // Fallback: find the largest CU value in logs
  let maxCu = 0;
  for (const log of tx.meta.logMessages || []) {
    const match = log.match(/consumed (\d+) of \d+ compute units/);
    if (match) maxCu = Math.max(maxCu, parseInt(match[1]));
  }
  return maxCu || null;
}

describe("benchmark: compute units per instruction", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.seekerIou as Program<SeekerIou>;
  const connection = provider.connection;

  const owner = Keypair.generate();
  const recipient = Keypair.generate();
  const settler = Keypair.generate();
  const tempSgtAuthority = Keypair.generate();

  let tokenMint: PublicKey;
  let sgtMint: PublicKey;
  let ownerTokenAccount: PublicKey;
  let sgtTokenAccount: PublicKey;
  let vaultPda: PublicKey;
  let reputationPda: PublicKey;

  const results: { instruction: string; computeUnits: number }[] = [];

  before(async () => {
    for (const kp of [owner, recipient, settler]) {
      const sig = await connection.requestAirdrop(
        kp.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig);
    }

    tokenMint = await createMint(connection, owner, owner.publicKey, null, 9);
    ownerTokenAccount = await createAccount(
      connection,
      owner,
      tokenMint,
      owner.publicKey
    );
    await mintTo(
      connection,
      owner,
      tokenMint,
      ownerTokenAccount,
      owner,
      10_000_000_000n
    );

    sgtMint = await createMint(
      connection,
      owner,
      tempSgtAuthority.publicKey,
      null,
      0
    );
    sgtTokenAccount = await createAccount(
      connection,
      owner,
      sgtMint,
      owner.publicKey
    );
    await mintTo(
      connection,
      owner,
      sgtMint,
      sgtTokenAccount,
      tempSgtAuthority,
      1
    );
    await setAuthority(
      connection,
      owner,
      sgtMint,
      tempSgtAuthority,
      AuthorityType.MintTokens,
      SGT_MINT_AUTHORITY
    );

    [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer(), tokenMint.toBuffer()],
      program.programId
    );
    [reputationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), sgtMint.toBuffer()],
      program.programId
    );
  });

  after(() => {
    console.log("\n╔══════════════════════════════════════════════════╗");
    console.log("║         COMPUTE UNIT BENCHMARK RESULTS           ║");
    console.log("╠══════════════════════════════════════════════════╣");
    for (const r of results) {
      const name = r.instruction.padEnd(30);
      const cu = r.computeUnits.toLocaleString().padStart(10);
      console.log(`║  ${name}  ${cu} CU  ║`);
    }
    console.log("╚══════════════════════════════════════════════════╝");
  });

  it("create_vault", async () => {
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      vaultPda,
      true
    );

    const txSig = await program.methods
      .createVault(3000, 3600)
      .accountsStrict({
        owner: owner.publicKey,
        vault: vaultPda,
        tokenMint,
        vaultTokenAccount,
        sgtTokenAccount,
        sgtMint,
        reputation: reputationPda,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const cu = await getComputeUnits(connection, txSig);
    results.push({ instruction: "create_vault", computeUnits: cu || 0 });
  });

  it("deposit", async () => {
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      vaultPda,
      true
    );

    const txSig = await program.methods
      .deposit(new anchor.BN("1000000000"))
      .accountsStrict({
        owner: owner.publicKey,
        vault: vaultPda,
        tokenMint,
        ownerTokenAccount,
        vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const cu = await getComputeUnits(connection, txSig);
    results.push({ instruction: "deposit", computeUnits: cu || 0 });
  });

  it("settle_iou (success)", async () => {
    const nonce = 1n;
    const amount = 100_000_000n;

    const iouMessage = createIOUMessageBytes({
      vault: vaultPda,
      sender: owner.publicKey,
      recipient: recipient.publicKey,
      tokenMint,
      amount,
      nonce,
      expiry: 0n,
      sgtMint,
    });

    const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: owner.secretKey,
      message: iouMessage,
    });
    const sigOffset = ed25519Ix.data[2] | (ed25519Ix.data[3] << 8);
    const signature = ed25519Ix.data.slice(sigOffset, sigOffset + 64);

    const vaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      vaultPda,
      true
    );
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      recipient.publicKey
    );
    const [settlementRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("settlement"), vaultPda.toBuffer(), nonceToLeBytes(nonce)],
      program.programId
    );

    const settleIx = await program.methods
      .settleIou(
        Buffer.from(iouMessage),
        Array.from(signature) as any,
        new anchor.BN(nonce.toString())
      )
      .accountsStrict({
        settler: settler.publicKey,
        vault: vaultPda,
        tokenMint,
        vaultTokenAccount,
        recipient: recipient.publicKey,
        recipientTokenAccount,
        settlementRecord: settlementRecordPda,
        reputation: reputationPda,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([settler])
      .instruction();

    const tx = new Transaction().add(ed25519Ix).add(settleIx);
    const txSig = await sendAndConfirmTransaction(connection, tx, [settler], {
      commitment: "confirmed",
    });

    const cu = await getComputeUnits(connection, txSig);
    results.push({
      instruction: "settle_iou (success)",
      computeUnits: cu || 0,
    });
  });

  it("settle_iou (fail + bond slash)", async () => {
    const nonce = 2n;
    const amount = 999_000_000_000n;

    const iouMessage = createIOUMessageBytes({
      vault: vaultPda,
      sender: owner.publicKey,
      recipient: recipient.publicKey,
      tokenMint,
      amount,
      nonce,
      expiry: 0n,
      sgtMint,
    });

    const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
      privateKey: owner.secretKey,
      message: iouMessage,
    });
    const sigOffset = ed25519Ix.data[2] | (ed25519Ix.data[3] << 8);
    const signature = ed25519Ix.data.slice(sigOffset, sigOffset + 64);

    const vaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      vaultPda,
      true
    );
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      recipient.publicKey
    );
    const [settlementRecordPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("settlement"), vaultPda.toBuffer(), nonceToLeBytes(nonce)],
      program.programId
    );

    const settleIx = await program.methods
      .settleIou(
        Buffer.from(iouMessage),
        Array.from(signature) as any,
        new anchor.BN(nonce.toString())
      )
      .accountsStrict({
        settler: settler.publicKey,
        vault: vaultPda,
        tokenMint,
        vaultTokenAccount,
        recipient: recipient.publicKey,
        recipientTokenAccount,
        settlementRecord: settlementRecordPda,
        reputation: reputationPda,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([settler])
      .instruction();

    const tx = new Transaction().add(ed25519Ix).add(settleIx);
    const txSig = await sendAndConfirmTransaction(connection, tx, [settler], {
      commitment: "confirmed",
    });

    const cu = await getComputeUnits(connection, txSig);
    results.push({
      instruction: "settle_iou (fail+slash)",
      computeUnits: cu || 0,
    });
  });

  it("set_reserve_ratio", async () => {
    const txSig = await program.methods
      .setReserveRatio(5000)
      .accountsStrict({
        owner: owner.publicKey,
        vault: vaultPda,
      })
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const cu = await getComputeUnits(connection, txSig);
    results.push({
      instruction: "set_reserve_ratio",
      computeUnits: cu || 0,
    });

    // Reset
    await program.methods
      .setReserveRatio(3000)
      .accountsStrict({ owner: owner.publicKey, vault: vaultPda })
      .signers([owner])
      .rpc();
  });

  it("set_cooldown", async () => {
    const txSig = await program.methods
      .setCooldown(7200)
      .accountsStrict({
        owner: owner.publicKey,
        vault: vaultPda,
      })
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const cu = await getComputeUnits(connection, txSig);
    results.push({ instruction: "set_cooldown", computeUnits: cu || 0 });

    await program.methods
      .setCooldown(3600)
      .accountsStrict({ owner: owner.publicKey, vault: vaultPda })
      .signers([owner])
      .rpc();
  });

  it("deactivate_vault", async () => {
    const txSig = await program.methods
      .deactivateVault()
      .accountsStrict({
        owner: owner.publicKey,
        vault: vaultPda,
      })
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const cu = await getComputeUnits(connection, txSig);
    results.push({ instruction: "deactivate_vault", computeUnits: cu || 0 });
  });

  it("reactivate_vault", async () => {
    const txSig = await program.methods
      .reactivateVault()
      .accountsStrict({
        owner: owner.publicKey,
        vault: vaultPda,
      })
      .signers([owner])
      .rpc({ commitment: "confirmed" });

    const cu = await getComputeUnits(connection, txSig);
    results.push({ instruction: "reactivate_vault", computeUnits: cu || 0 });
  });
});
