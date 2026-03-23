/**
 * Vault management service.
 * Wraps the seeker-iou SDK instruction builders with wallet signing.
 */

import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createVaultInstruction,
  createDepositInstruction,
  createDeactivateVaultInstruction,
  createReactivateVaultInstruction,
  createWithdrawInstruction,
  createSetReserveRatioInstruction,
  createSetCooldownInstruction,
  deriveVaultPda,
  verifySeekerForVault,
  type VaultAccount,
} from "seeker-iou";
import { connection, signAndSendTransaction } from "./wallet";

export async function createVault(params: {
  owner: PublicKey;
  tokenMint: PublicKey;
  reserveRatioBps?: number;
  cooldownSeconds?: number;
}): Promise<string> {
  const sgtMint = await verifySeekerForVault(connection, params.owner);

  // Need to get the SGT token account for this owner
  const sgtTokenAccounts = await connection.getTokenAccountsByOwner(
    params.owner,
    { mint: sgtMint }
  );
  if (sgtTokenAccounts.value.length === 0) {
    throw new Error("No SGT token account found");
  }

  const ix = await createVaultInstruction({
    owner: params.owner,
    tokenMint: params.tokenMint,
    sgtMint,
    sgtTokenAccount: sgtTokenAccounts.value[0].pubkey,
    reserveRatioBps: params.reserveRatioBps,
    cooldownSeconds: params.cooldownSeconds,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = params.owner;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return signAndSendTransaction(tx);
}

export async function deposit(params: {
  owner: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;
}): Promise<string> {
  const [vault] = deriveVaultPda(params.owner, params.tokenMint);

  const ix = await createDepositInstruction({
    owner: params.owner,
    vault,
    tokenMint: params.tokenMint,
    amount: params.amount,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = params.owner;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return signAndSendTransaction(tx);
}

export async function deactivateVault(params: {
  owner: PublicKey;
  tokenMint: PublicKey;
}): Promise<string> {
  const [vault] = deriveVaultPda(params.owner, params.tokenMint);

  const ix = await createDeactivateVaultInstruction({
    owner: params.owner,
    vault,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = params.owner;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return signAndSendTransaction(tx);
}

export async function withdraw(params: {
  owner: PublicKey;
  tokenMint: PublicKey;
}): Promise<string> {
  const [vault] = deriveVaultPda(params.owner, params.tokenMint);

  const ix = await createWithdrawInstruction({
    owner: params.owner,
    vault,
    tokenMint: params.tokenMint,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = params.owner;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  return signAndSendTransaction(tx);
}
