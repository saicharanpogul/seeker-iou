import { describe, it, expect } from "vitest";
import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { createIOUMessage } from "../src/iou";
import { verifySignature } from "../src/verification";
import { deriveVaultPda } from "../src/utils";

describe("signature verification", () => {
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

  it("verifies a valid signature", () => {
    const signature = nacl.sign.detached(message, sender.secretKey);
    const result = verifySignature(message, signature, sender.publicKey);
    expect(result).toBe(true);
  });

  it("rejects a signature from a different key", () => {
    const other = Keypair.generate();
    const signature = nacl.sign.detached(message, other.secretKey);
    const result = verifySignature(message, signature, sender.publicKey);
    expect(result).toBe(false);
  });

  it("rejects a tampered message", () => {
    const signature = nacl.sign.detached(message, sender.secretKey);
    const tampered = new Uint8Array(message);
    tampered[10] ^= 0xff;
    const result = verifySignature(tampered, signature, sender.publicKey);
    expect(result).toBe(false);
  });

  it("throws on invalid signature length", () => {
    expect(() =>
      verifySignature(message, new Uint8Array(32), sender.publicKey)
    ).toThrow("Invalid Ed25519 signature");
  });
});
