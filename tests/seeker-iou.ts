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
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  AuthorityType,
  setAuthority,
} from "@solana/spl-token";
import { expect } from "chai";
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
  memo?: Buffer;
}): Buffer {
  const memo = params.memo || Buffer.alloc(32);
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
    memo: Array.from(memo),
  };
  return Buffer.from(borshSerialize(IOUMessageSchema, data));
}

function nonceToLeBytes(nonce: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(nonce);
  return buf;
}

describe("seeker-iou", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.seekerIou as Program<SeekerIou>;
  const connection = provider.connection;

  const owner = Keypair.generate();
  const recipient = Keypair.generate();
  const settler = Keypair.generate();

  // Temporary authority for minting SGT before transferring to real authority
  const tempSgtAuthority = Keypair.generate();

  let tokenMint: PublicKey;
  let sgtMint: PublicKey;
  let ownerTokenAccount: PublicKey;
  let sgtTokenAccount: PublicKey;
  let vaultPda: PublicKey;
  let vaultBump: number;
  let reputationPda: PublicKey;

  const DEPOSIT_AMOUNT = 1_000_000_000n; // 1 token (9 decimals)

  before(async () => {
    // Airdrop SOL to test accounts
    for (const kp of [owner, recipient, settler]) {
      const sig = await connection.requestAirdrop(
        kp.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig);
    }

    // Create payment token mint
    tokenMint = await createMint(connection, owner, owner.publicKey, null, 9);

    // Create owner token account and mint tokens
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

    // Create SGT mint with temp authority, mint 1 SGT, then transfer authority to known SGT_MINT_AUTHORITY
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

    // Transfer mint authority to the known SGT_MINT_AUTHORITY address
    await setAuthority(
      connection,
      owner,
      sgtMint,
      tempSgtAuthority,
      AuthorityType.MintTokens,
      SGT_MINT_AUTHORITY
    );

    // Derive PDAs
    [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer(), tokenMint.toBuffer()],
      program.programId
    );
    [reputationPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reputation"), sgtMint.toBuffer()],
      program.programId
    );
  });

  describe("create_vault", () => {
    it("creates a vault with SGT verification", async () => {
      const vaultTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        vaultPda,
        true
      );

      await program.methods
        .createVault()
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
        .rpc();

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.owner.toBase58()).to.equal(owner.publicKey.toBase58());
      expect(vault.tokenMint.toBase58()).to.equal(tokenMint.toBase58());
      expect(vault.depositedAmount.toNumber()).to.equal(0);
      expect(vault.spentAmount.toNumber()).to.equal(0);
      expect(vault.currentNonce.toNumber()).to.equal(0);
      expect(vault.isActive).to.be.true;
      expect(vault.cooldownSeconds).to.equal(3600);

      const reputation = await program.account.reputationAccount.fetch(
        reputationPda
      );
      expect(reputation.sgtMint.toBase58()).to.equal(sgtMint.toBase58());
      expect(reputation.totalIssued.toNumber()).to.equal(0);
    });
  });

  describe("deposit", () => {
    it("deposits tokens into the vault", async () => {
      const vaultTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        vaultPda,
        true
      );

      await program.methods
        .deposit(new anchor.BN(DEPOSIT_AMOUNT.toString()))
        .accountsStrict({
          owner: owner.publicKey,
          vault: vaultPda,
          tokenMint,
          ownerTokenAccount,
          vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([owner])
        .rpc();

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.depositedAmount.toString()).to.equal(
        DEPOSIT_AMOUNT.toString()
      );
    });

    it("fails to deposit zero amount", async () => {
      const vaultTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        vaultPda,
        true
      );

      try {
        await program.methods
          .deposit(new anchor.BN(0))
          .accountsStrict({
            owner: owner.publicKey,
            vault: vaultPda,
            tokenMint,
            ownerTokenAccount,
            vaultTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([owner])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InvalidDepositAmount");
      }
    });
  });

  describe("settle_iou", () => {
    it("settles a valid IOU", async () => {
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

      // Ed25519Program expects the full 64-byte secret key
      const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
        privateKey: owner.secretKey,
        message: iouMessage,
      });

      // Extract signature from Ed25519 instruction data
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
        [
          Buffer.from("settlement"),
          vaultPda.toBuffer(),
          nonceToLeBytes(nonce),
        ],
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
      await sendAndConfirmTransaction(connection, tx, [settler]);

      // Verify settlement
      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.spentAmount.toString()).to.equal(amount.toString());
      expect(vault.currentNonce.toNumber()).to.equal(Number(nonce));

      const record = await program.account.settlementRecord.fetch(
        settlementRecordPda
      );
      expect(record.success).to.be.true;
      expect(record.amount.toString()).to.equal(amount.toString());

      const reputation = await program.account.reputationAccount.fetch(
        reputationPda
      );
      expect(reputation.totalIssued.toNumber()).to.equal(1);
      expect(reputation.totalSettled.toNumber()).to.equal(1);
      expect(reputation.totalVolume.toString()).to.equal(amount.toString());

      const recipientAcct = await getAccount(connection, recipientTokenAccount);
      expect(recipientAcct.amount.toString()).to.equal(amount.toString());
    });

    it("fails with replay (same nonce)", async () => {
      const nonce = 1n;
      const amount = 50_000_000n;

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
        [
          Buffer.from("settlement"),
          vaultPda.toBuffer(),
          nonceToLeBytes(nonce),
        ],
        program.programId
      );

      try {
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
        await sendAndConfirmTransaction(connection, tx, [settler]);
        expect.fail("Should have thrown - replay attack");
      } catch (err: any) {
        // PDA already exists or nonce check fails
        expect(err).to.exist;
      }
    });

    it("fails with nonce out of order", async () => {
      // First settle nonce 3 (skip 2)
      const nonce3 = 3n;
      const amount = 50_000_000n;
      const vaultTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        vaultPda,
        true
      );
      const recipientTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        recipient.publicKey
      );

      const iouMessage3 = createIOUMessageBytes({
        vault: vaultPda,
        sender: owner.publicKey,
        recipient: recipient.publicKey,
        tokenMint,
        amount,
        nonce: nonce3,
        expiry: 0n,
        sgtMint,
      });

      const ed25519Ix3 = Ed25519Program.createInstructionWithPrivateKey({
        privateKey: owner.secretKey,
        message: iouMessage3,
      });
      const sigOffset3 = ed25519Ix3.data[2] | (ed25519Ix3.data[3] << 8);
      const signature3 = ed25519Ix3.data.slice(sigOffset3, sigOffset3 + 64);

      const [settlementRecordPda3] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("settlement"),
          vaultPda.toBuffer(),
          nonceToLeBytes(nonce3),
        ],
        program.programId
      );

      const settleIx3 = await program.methods
        .settleIou(
          Buffer.from(iouMessage3),
          Array.from(signature3) as any,
          new anchor.BN(nonce3.toString())
        )
        .accountsStrict({
          settler: settler.publicKey,
          vault: vaultPda,
          tokenMint,
          vaultTokenAccount,
          recipient: recipient.publicKey,
          recipientTokenAccount,
          settlementRecord: settlementRecordPda3,
          reputation: reputationPda,
          instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([settler])
        .instruction();

      const tx3 = new Transaction().add(ed25519Ix3).add(settleIx3);
      await sendAndConfirmTransaction(connection, tx3, [settler]);

      // Now try nonce 2 (should fail, current nonce is now 3)
      const nonce2 = 2n;
      const iouMessage2 = createIOUMessageBytes({
        vault: vaultPda,
        sender: owner.publicKey,
        recipient: recipient.publicKey,
        tokenMint,
        amount,
        nonce: nonce2,
        expiry: 0n,
        sgtMint,
      });

      const ed25519Ix2 = Ed25519Program.createInstructionWithPrivateKey({
        privateKey: owner.secretKey,
        message: iouMessage2,
      });
      const sigOffset2 = ed25519Ix2.data[2] | (ed25519Ix2.data[3] << 8);
      const signature2 = ed25519Ix2.data.slice(sigOffset2, sigOffset2 + 64);

      const [settlementRecordPda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("settlement"),
          vaultPda.toBuffer(),
          nonceToLeBytes(nonce2),
        ],
        program.programId
      );

      try {
        const settleIx2 = await program.methods
          .settleIou(
            Buffer.from(iouMessage2),
            Array.from(signature2) as any,
            new anchor.BN(nonce2.toString())
          )
          .accountsStrict({
            settler: settler.publicKey,
            vault: vaultPda,
            tokenMint,
            vaultTokenAccount,
            recipient: recipient.publicKey,
            recipientTokenAccount,
            settlementRecord: settlementRecordPda2,
            reputation: reputationPda,
            instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          })
          .signers([settler])
          .instruction();

        const tx2 = new Transaction().add(ed25519Ix2).add(settleIx2);
        await sendAndConfirmTransaction(connection, tx2, [settler]);
        expect.fail("Should have thrown - nonce out of order");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });

    it("handles overdraw - records failure and updates reputation", async () => {
      const nonce = 4n;
      const amount = 999_000_000_000n; // Way more than vault balance

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
        [
          Buffer.from("settlement"),
          vaultPda.toBuffer(),
          nonceToLeBytes(nonce),
        ],
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
      await sendAndConfirmTransaction(connection, tx, [settler]);

      const record = await program.account.settlementRecord.fetch(
        settlementRecordPda
      );
      expect(record.success).to.be.false;

      const reputation = await program.account.reputationAccount.fetch(
        reputationPda
      );
      expect(reputation.totalFailed.toNumber()).to.equal(1);
      expect(reputation.lastFailureAt.toNumber()).to.be.greaterThan(0);
    });

    it("fails with wrong token mint in IOU", async () => {
      const wrongMint = await createMint(
        connection,
        owner,
        owner.publicKey,
        null,
        9
      );

      const nonce = 5n;
      const amount = 10_000_000n;

      const iouMessage = createIOUMessageBytes({
        vault: vaultPda,
        sender: owner.publicKey,
        recipient: recipient.publicKey,
        tokenMint: wrongMint,
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
        [
          Buffer.from("settlement"),
          vaultPda.toBuffer(),
          nonceToLeBytes(nonce),
        ],
        program.programId
      );

      try {
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
        await sendAndConfirmTransaction(connection, tx, [settler]);
        expect.fail("Should have thrown - wrong token mint");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });

    it("fails with expired IOU", async () => {
      const nonce = 6n;
      const amount = 10_000_000n;
      const pastExpiry = BigInt(Math.floor(Date.now() / 1000) - 3600);

      const iouMessage = createIOUMessageBytes({
        vault: vaultPda,
        sender: owner.publicKey,
        recipient: recipient.publicKey,
        tokenMint,
        amount,
        nonce,
        expiry: pastExpiry,
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
        [
          Buffer.from("settlement"),
          vaultPda.toBuffer(),
          nonceToLeBytes(nonce),
        ],
        program.programId
      );

      try {
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
        await sendAndConfirmTransaction(connection, tx, [settler]);
        expect.fail("Should have thrown - expired IOU");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });

    it("fails with forged signature", async () => {
      const nonce = 7n;
      const amount = 10_000_000n;

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

      // Sign with a different keypair (forger)
      const forger = Keypair.generate();
      const ed25519Ix = Ed25519Program.createInstructionWithPrivateKey({
        privateKey: forger.secretKey,
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
        [
          Buffer.from("settlement"),
          vaultPda.toBuffer(),
          nonceToLeBytes(nonce),
        ],
        program.programId
      );

      try {
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
        await sendAndConfirmTransaction(connection, tx, [settler]);
        expect.fail("Should have thrown - forged signature");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });
  });

  describe("deactivate_vault", () => {
    it("deactivates the vault", async () => {
      await program.methods
        .deactivateVault()
        .accountsStrict({
          owner: owner.publicKey,
          vault: vaultPda,
        })
        .signers([owner])
        .rpc();

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.isActive).to.be.false;
      expect(vault.deactivatedAt.toNumber()).to.be.greaterThan(0);
    });

    it("fails to settle against deactivated vault", async () => {
      const nonce = 8n;
      const amount = 10_000_000n;

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
        [
          Buffer.from("settlement"),
          vaultPda.toBuffer(),
          nonceToLeBytes(nonce),
        ],
        program.programId
      );

      try {
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
        await sendAndConfirmTransaction(connection, tx, [settler]);
        expect.fail("Should have thrown - vault deactivated");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });
  });

  describe("withdraw", () => {
    it("fails to withdraw before cooldown", async () => {
      const vaultTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        vaultPda,
        true
      );

      try {
        await program.methods
          .withdraw()
          .accountsStrict({
            owner: owner.publicKey,
            vault: vaultPda,
            tokenMint,
            vaultTokenAccount,
            ownerTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([owner])
          .rpc();
        expect.fail("Should have thrown - cooldown not elapsed");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("CooldownNotElapsed");
      }
    });
  });

  describe("reactivate_vault", () => {
    it("reactivates the vault", async () => {
      await program.methods
        .reactivateVault()
        .accountsStrict({
          owner: owner.publicKey,
          vault: vaultPda,
        })
        .signers([owner])
        .rpc();

      const vault = await program.account.vault.fetch(vaultPda);
      expect(vault.isActive).to.be.true;
      expect(vault.deactivatedAt.toNumber()).to.equal(0);
    });
  });
});
