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
import { deriveVaultPda, deriveReputationPda } from "./utils";

function getProgram(): Program {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const idl = require("../idl/seeker_iou.json");
  return new Program(idl);
}

export async function createVaultInstruction(params: {
  owner: PublicKey;
  tokenMint: PublicKey;
  sgtMint: PublicKey;
  sgtTokenAccount: PublicKey;
  /** Reserve ratio in basis points (0-10000). Default 0. */
  reserveRatioBps?: number;
  /** Cooldown in seconds. Pass 0 for default (3600). Min 300. */
  cooldownSeconds?: number;
}): Promise<TransactionInstruction> {
  const [vaultPda] = deriveVaultPda(params.owner, params.tokenMint);
  const [reputationPda] = deriveReputationPda(params.sgtMint);
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    params.tokenMint,
    vaultPda,
    true
  );

  const program = getProgram();
  return program.methods
    .createVault(params.reserveRatioBps ?? 0, params.cooldownSeconds ?? 0)
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

export async function createDepositInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;
}): Promise<TransactionInstruction> {
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

export async function createDeactivateVaultInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
}): Promise<TransactionInstruction> {
  const program = getProgram();
  return program.methods
    .deactivateVault()
    .accountsStrict({
      owner: params.owner,
      vault: params.vault,
    })
    .instruction();
}

export async function createReactivateVaultInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
}): Promise<TransactionInstruction> {
  const program = getProgram();
  return program.methods
    .reactivateVault()
    .accountsStrict({
      owner: params.owner,
      vault: params.vault,
    })
    .instruction();
}

export async function createWithdrawInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
  tokenMint: PublicKey;
}): Promise<TransactionInstruction> {
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

export async function createSetReserveRatioInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
  reserveRatioBps: number;
}): Promise<TransactionInstruction> {
  const program = getProgram();
  return program.methods
    .setReserveRatio(params.reserveRatioBps)
    .accountsStrict({
      owner: params.owner,
      vault: params.vault,
    })
    .instruction();
}

export async function createSetCooldownInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
  cooldownSeconds: number;
}): Promise<TransactionInstruction> {
  const program = getProgram();
  return program.methods
    .setCooldown(params.cooldownSeconds)
    .accountsStrict({
      owner: params.owner,
      vault: params.vault,
    })
    .instruction();
}
