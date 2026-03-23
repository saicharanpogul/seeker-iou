import { PublicKey } from "@solana/web3.js";
import {
  PROGRAM_ID,
  VAULT_SEED,
  SETTLEMENT_SEED,
  REPUTATION_SEED,
} from "./constants";

export function deriveVaultPda(
  owner: PublicKey,
  tokenMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [VAULT_SEED, owner.toBuffer(), tokenMint.toBuffer()],
    PROGRAM_ID
  );
}

export function deriveSettlementRecordPda(
  vault: PublicKey,
  nonce: number
): [PublicKey, number] {
  const nonceBuffer = Buffer.alloc(8);
  nonceBuffer.writeBigUInt64LE(BigInt(nonce));
  return PublicKey.findProgramAddressSync(
    [SETTLEMENT_SEED, vault.toBuffer(), nonceBuffer],
    PROGRAM_ID
  );
}

export function deriveReputationPda(
  sgtMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [REPUTATION_SEED, sgtMint.toBuffer()],
    PROGRAM_ID
  );
}

export function formatAmount(
  amount: bigint,
  decimals: number
): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === 0n) {
    return whole.toString();
  }
  const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${fractionStr}`;
}

/**
 * Calculate the bond amount for a vault given its remaining balance and reserve ratio.
 */
export function calculateBondAmount(
  remainingBalance: bigint,
  reserveRatioBps: number
): bigint {
  return (remainingBalance * BigInt(reserveRatioBps)) / 10000n;
}

/**
 * Calculate the balance available for IOUs (remaining minus bond).
 */
export function calculateAvailableForIOUs(
  remainingBalance: bigint,
  reserveRatioBps: number
): bigint {
  const bond = calculateBondAmount(remainingBalance, reserveRatioBps);
  return remainingBalance - bond;
}

export function parseAmount(
  amount: string,
  decimals: number
): bigint {
  const parts = amount.split(".");
  const whole = BigInt(parts[0]) * 10n ** BigInt(decimals);
  if (parts.length === 1) {
    return whole;
  }
  const fractionStr = parts[1].padEnd(decimals, "0").slice(0, decimals);
  return whole + BigInt(fractionStr);
}
