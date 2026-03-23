import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program } from "@coral-xyz/anchor";
import { PROGRAM_ID } from "./constants";
import { deriveVaultPda, deriveReputationPda } from "./utils";

function getProgram(): Program {
  // Lazy-load IDL to avoid circular deps
  const idl = require("../idl/seeker_iou.json");
  return new Program(idl, PROGRAM_ID);
}

export function createVaultInstruction(params: {
  owner: PublicKey;
  tokenMint: PublicKey;
  sgtMint: PublicKey;
  sgtTokenAccount: PublicKey;
}): TransactionInstruction {
  const [vaultPda] = deriveVaultPda(params.owner, params.tokenMint);
  const [reputationPda] = deriveReputationPda(params.sgtMint);
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    params.tokenMint,
    vaultPda,
    true
  );

  const program = getProgram();
  return program.methods
    .createVault()
    .accountsStrict({
      owner: params.owner,
      vault: vaultPda,
      tokenMint: params.tokenMint,
      vaultTokenAccount,
      sgtTokenAccount: params.sgtTokenAccount,
      sgtMint: params.sgtMint,
      reputation: reputationPda,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export function createDepositInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;
}): TransactionInstruction {
  const ownerTokenAccount = getAssociatedTokenAddressSync(
    params.tokenMint,
    params.owner
  );
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    params.tokenMint,
    params.vault,
    true
  );

  const program = getProgram();
  return program.methods
    .deposit(params.amount)
    .accountsStrict({
      owner: params.owner,
      vault: params.vault,
      tokenMint: params.tokenMint,
      ownerTokenAccount,
      vaultTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export function createDeactivateVaultInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
}): TransactionInstruction {
  const program = getProgram();
  return program.methods
    .deactivateVault()
    .accountsStrict({
      owner: params.owner,
      vault: params.vault,
    })
    .instruction();
}

export function createReactivateVaultInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
}): TransactionInstruction {
  const program = getProgram();
  return program.methods
    .reactivateVault()
    .accountsStrict({
      owner: params.owner,
      vault: params.vault,
    })
    .instruction();
}

export function createWithdrawInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
  tokenMint: PublicKey;
}): TransactionInstruction {
  const ownerTokenAccount = getAssociatedTokenAddressSync(
    params.tokenMint,
    params.owner
  );
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    params.tokenMint,
    params.vault,
    true
  );

  const program = getProgram();
  return program.methods
    .withdraw()
    .accountsStrict({
      owner: params.owner,
      vault: params.vault,
      tokenMint: params.tokenMint,
      vaultTokenAccount,
      ownerTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}
