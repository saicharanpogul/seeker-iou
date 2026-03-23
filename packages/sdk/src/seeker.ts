/**
 * Seeker device verification and .skr domain resolution.
 *
 * Re-exports from seeker-sdk for convenience, plus IOU-specific helpers
 * that combine SGT verification with vault operations.
 */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  verifySGT,
  isSeeker,
  getSGTDetails,
  resolveSkrDomain,
  reverseResolveSkr,
  isSkrDomain,
  getSkrDomains,
  getSeekerProfile,
  type SGTResult,
  type SGTVerifyOptions,
  type SeekerProfile,
} from "seeker-sdk";

// Re-export seeker-sdk verification functions
export {
  verifySGT,
  isSeeker,
  getSGTDetails,
  resolveSkrDomain,
  reverseResolveSkr,
  isSkrDomain,
  getSkrDomains,
  getSeekerProfile,
};

// Re-export types
export type { SGTResult, SGTVerifyOptions, SeekerProfile };

/**
 * Verify that a wallet is a Seeker owner before vault creation.
 * Returns the SGT mint address needed for vault PDA derivation.
 *
 * @returns SGT mint public key if verified
 * @throws if wallet does not own a valid SGT
 */
export async function verifySeekerForVault(
  connection: Connection,
  walletAddress: string | PublicKey
): Promise<PublicKey> {
  const result = await getSGTDetails(connection, walletAddress);
  if (!result.isSeeker || !result.mintAddress) {
    throw new Error(
      `Wallet ${result.walletAddress} does not own a verified Seeker Genesis Token`
    );
  }
  return new PublicKey(result.mintAddress);
}

/**
 * Resolve a recipient address to a human-readable .skr domain.
 * Returns the domain if one exists, otherwise returns null.
 * Useful for displaying "chai-vendor.skr" instead of a base58 address.
 */
export async function resolveRecipientDisplay(
  connection: Connection,
  recipientAddress: string | PublicKey
): Promise<string | null> {
  return reverseResolveSkr(connection, recipientAddress);
}
