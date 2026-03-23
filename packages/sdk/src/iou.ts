import { PublicKey } from "@solana/web3.js";
import { IOUParams } from "./types";
import {
  IOU_VERSION,
  IOU_MESSAGE_SIZE,
} from "./constants";
import {
  InvalidIOUVersionError,
  InvalidMemoError,
  SerializationError,
} from "./errors";

/**
 * Create a serialized IOU message in Borsh format.
 * Layout matches the on-chain IOUMessage struct exactly:
 * - version: u8 (1 byte)
 * - vault: Pubkey (32 bytes)
 * - sender: Pubkey (32 bytes)
 * - recipient: Pubkey (32 bytes)
 * - token_mint: Pubkey (32 bytes)
 * - amount: u64 (8 bytes LE)
 * - nonce: u64 (8 bytes LE)
 * - expiry: i64 (8 bytes LE)
 * - sgt_mint: Pubkey (32 bytes)
 * - memo: [u8; 32] (32 bytes)
 * Total: 217 bytes
 */
export function createIOUMessage(params: IOUParams): Uint8Array {
  const buf = Buffer.alloc(IOU_MESSAGE_SIZE);
  let offset = 0;

  // version: u8
  buf.writeUInt8(IOU_VERSION, offset);
  offset += 1;

  // vault: Pubkey
  params.vault.toBuffer().copy(buf, offset);
  offset += 32;

  // sender: Pubkey
  params.sender.toBuffer().copy(buf, offset);
  offset += 32;

  // recipient: Pubkey
  params.recipient.toBuffer().copy(buf, offset);
  offset += 32;

  // token_mint: Pubkey
  params.tokenMint.toBuffer().copy(buf, offset);
  offset += 32;

  // amount: u64 (LE)
  buf.writeBigUInt64LE(params.amount, offset);
  offset += 8;

  // nonce: u64 (LE)
  buf.writeBigUInt64LE(BigInt(params.nonce), offset);
  offset += 8;

  // expiry: i64 (LE)
  buf.writeBigInt64LE(BigInt(params.expiry ?? 0), offset);
  offset += 8;

  // sgt_mint: Pubkey
  params.sgtMint.toBuffer().copy(buf, offset);
  offset += 32;

  // memo: [u8; 32] (zero-padded)
  if (params.memo) {
    const memoBytes = Buffer.from(params.memo, "utf-8");
    if (memoBytes.length > 32) {
      throw new InvalidMemoError();
    }
    memoBytes.copy(buf, offset);
  }

  return new Uint8Array(buf);
}

/**
 * Deserialize an IOU message from Borsh bytes back to structured data.
 */
export function parseIOUMessage(data: Uint8Array): IOUParams {
  if (data.length !== IOU_MESSAGE_SIZE) {
    throw new SerializationError(
      `Expected ${IOU_MESSAGE_SIZE} bytes, got ${data.length}`
    );
  }

  const buf = Buffer.from(data);
  let offset = 0;

  const version = buf.readUInt8(offset);
  offset += 1;
  if (version !== IOU_VERSION) {
    throw new InvalidIOUVersionError();
  }

  const vault = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;

  const sender = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;

  const recipient = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;

  const tokenMint = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;

  const amount = buf.readBigUInt64LE(offset);
  offset += 8;

  const nonce = Number(buf.readBigUInt64LE(offset));
  offset += 8;

  const expiry = Number(buf.readBigInt64LE(offset));
  offset += 8;

  const sgtMint = new PublicKey(buf.subarray(offset, offset + 32));
  offset += 32;

  const memoBytes = buf.subarray(offset, offset + 32);
  const memoEnd = memoBytes.indexOf(0);
  const memo =
    memoEnd === 0
      ? undefined
      : memoBytes
          .subarray(0, memoEnd === -1 ? 32 : memoEnd)
          .toString("utf-8");

  return {
    vault,
    sender,
    recipient,
    tokenMint,
    amount,
    nonce,
    sgtMint,
    expiry: expiry === 0 ? undefined : expiry,
    memo,
  };
}

/**
 * Verify an IOU signature client-side using tweetnacl.
 */
export function verifyIOUSignature(
  message: Uint8Array,
  signature: Uint8Array,
  senderPublicKey: PublicKey
): boolean {
  // Delegate to verification module to avoid circular deps
  // This is re-exported for convenience
  const { verifySignature } = require("./verification");
  return verifySignature(message, signature, senderPublicKey);
}
