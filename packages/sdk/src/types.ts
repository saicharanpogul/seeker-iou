import { PublicKey } from "@solana/web3.js";

export interface VaultAccount {
  owner: PublicKey;
  tokenMint: PublicKey;
  tokenAccount: PublicKey;
  depositedAmount: bigint;
  spentAmount: bigint;
  currentNonce: bigint;
  sgtMint: PublicKey;
  createdAt: bigint;
  isActive: boolean;
  deactivatedAt: bigint;
  cooldownSeconds: number;
  /** Reserve ratio in basis points (0-10000). Portion of remaining balance locked as bond. */
  reserveRatioBps: number;
  /** Cumulative amount slashed from the bond for failed settlements. */
  totalSlashed: bigint;
  bump: number;
}

export interface SettlementRecord {
  vault: PublicKey;
  recipient: PublicKey;
  amount: bigint;
  nonce: bigint;
  settledAt: bigint;
  settledBy: PublicKey;
  success: boolean;
  /** Amount slashed from bond on failed settlement (0 if success or no bond). */
  slashAmount: bigint;
  bump: number;
}

export interface ReputationAccount {
  sgtMint: PublicKey;
  totalIssued: bigint;
  totalSettled: bigint;
  totalFailed: bigint;
  totalVolume: bigint;
  lastFailureAt: bigint;
  createdAt: bigint;
  bump: number;
}

export interface IOUParams {
  vault: PublicKey;
  sender: PublicKey;
  recipient: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;
  nonce: number;
  sgtMint: PublicKey;
  expiry?: number;
  memo?: string;
}

export interface NFCPayload {
  message: Uint8Array;
  signature: Uint8Array;
}

export interface LocalVaultState {
  vaultAddress: string;
  tokenMint: string;
  depositedAmount: bigint;
  spentAmount: bigint;
  currentNonce: number;
  pendingIOUs: PendingIOU[];
}

export interface PendingIOU {
  recipient: string;
  amount: bigint;
  nonce: number;
  message: Uint8Array;
  signature: Uint8Array;
  createdAt: number;
  settled: boolean;
}

export interface ReceivedIOU {
  sender: string;
  senderSgtMint: string;
  amount: bigint;
  nonce: number;
  message: Uint8Array;
  signature: Uint8Array;
  receivedAt: number;
  settled: boolean;
  settlementTx: string | null;
}

export interface RiskConfig {
  autoAcceptBelow: bigint;
  warnAbove: bigint;
  requireOnlineAbove: bigint;
  minTrustScore: number;
}
