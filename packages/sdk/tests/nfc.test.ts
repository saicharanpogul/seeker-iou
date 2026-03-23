import { describe, it, expect } from "vitest";
import { Keypair } from "@solana/web3.js";
import { createIOUMessage } from "../src/iou";
import {
  encodeNFCPayload,
  decodeNFCPayload,
  validateNFCPayload,
} from "../src/nfc";
import { deriveVaultPda } from "../src/utils";
import { IOU_MESSAGE_SIZE, IOU_SIGNATURE_SIZE } from "../src/constants";

describe("NFC payload", () => {
  const sender = Keypair.generate();
  const recipient = Keypair.generate();
  const tokenMint = Keypair.generate().publicKey;
  const sgtMint = Keypair.generate().publicKey;
  const [vault] = deriveVaultPda(sender.publicKey, tokenMint);

  const message = createIOUMessage({
    vault,
    sender: sender.publicKey,
    recipient: recipient.publicKey,
    tokenMint,
    amount: 1000000n,
    nonce: 1,
    sgtMint,
  });
  const signature = new Uint8Array(64).fill(0xab);

  it("encodes and decodes NFC payload roundtrip", () => {
    const encoded = encodeNFCPayload({ message, signature });
    const decoded = decodeNFCPayload(encoded);

    expect(Buffer.from(decoded.message).equals(Buffer.from(message))).toBe(
      true
    );
    expect(
      Buffer.from(decoded.signature).equals(Buffer.from(signature))
    ).toBe(true);
  });

  it("validates a valid NFC payload", () => {
    const encoded = encodeNFCPayload({ message, signature });
    const result = validateNFCPayload(encoded);

    expect(result.valid).toBe(true);
    expect(result.iou).not.toBeNull();
    expect(result.signature).not.toBeNull();
    expect(result.error).toBeNull();
  });

  it("rejects truncated data", () => {
    const result = validateNFCPayload(new Uint8Array(5));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too short");
  });

  it("rejects wrong message size", () => {
    expect(() =>
      encodeNFCPayload({
        message: new Uint8Array(100),
        signature,
      })
    ).toThrow(`Message must be ${IOU_MESSAGE_SIZE} bytes`);
  });

  it("rejects wrong signature size", () => {
    expect(() =>
      encodeNFCPayload({
        message,
        signature: new Uint8Array(32),
      })
    ).toThrow(`Signature must be ${IOU_SIGNATURE_SIZE} bytes`);
  });
});
