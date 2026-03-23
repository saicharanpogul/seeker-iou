import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { InvalidSignatureError } from "./errors";

/**
 * Verify an Ed25519 signature over an IOU message client-side.
 * Uses tweetnacl for verification (same algorithm as Solana's Ed25519 precompile).
 */
export function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  senderPublicKey: PublicKey
): boolean {
  if (signature.length !== 64) {
    throw new InvalidSignatureError();
  }
  return nacl.sign.detached.verify(
    message,
    signature,
    senderPublicKey.toBytes()
  );
}
