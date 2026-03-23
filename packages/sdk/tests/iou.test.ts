import { describe, it, expect } from "vitest";
import { Keypair } from "@solana/web3.js";
import { createIOUMessage, parseIOUMessage } from "../src/iou";
import { IOU_MESSAGE_SIZE } from "../src/constants";
import { deriveVaultPda } from "../src/utils";

describe("IOU serialization", () => {
  const sender = Keypair.generate();
  const recipient = Keypair.generate();
  const tokenMint = Keypair.generate().publicKey;
  const sgtMint = Keypair.generate().publicKey;
  const [vault] = deriveVaultPda(sender.publicKey, tokenMint);

  it("creates a message of exactly 217 bytes", () => {
    const message = createIOUMessage({
      vault,
      sender: sender.publicKey,
      recipient: recipient.publicKey,
      tokenMint,
      amount: 1000000n,
      nonce: 1,
      sgtMint,
    });

    expect(message.length).toBe(IOU_MESSAGE_SIZE);
    expect(message.length).toBe(217);
  });

  it("roundtrip: create -> serialize -> deserialize -> verify identical", () => {
    const params = {
      vault,
      sender: sender.publicKey,
      recipient: recipient.publicKey,
      tokenMint,
      amount: 500_000_000n,
      nonce: 42,
      sgtMint,
      expiry: 1700000000,
      memo: "test payment",
    };

    const message = createIOUMessage(params);
    const parsed = parseIOUMessage(message);

    expect(parsed.vault.toBase58()).toBe(vault.toBase58());
    expect(parsed.sender.toBase58()).toBe(sender.publicKey.toBase58());
    expect(parsed.recipient.toBase58()).toBe(recipient.publicKey.toBase58());
    expect(parsed.tokenMint.toBase58()).toBe(tokenMint.toBase58());
    expect(parsed.amount).toBe(500_000_000n);
    expect(parsed.nonce).toBe(42);
    expect(parsed.sgtMint.toBase58()).toBe(sgtMint.toBase58());
    expect(parsed.expiry).toBe(1700000000);
    expect(parsed.memo).toBe("test payment");
  });

  it("roundtrip with no expiry and no memo", () => {
    const params = {
      vault,
      sender: sender.publicKey,
      recipient: recipient.publicKey,
      tokenMint,
      amount: 100n,
      nonce: 1,
      sgtMint,
    };

    const message = createIOUMessage(params);
    const parsed = parseIOUMessage(message);

    expect(parsed.expiry).toBeUndefined();
    expect(parsed.memo).toBeUndefined();
  });

  it("throws on memo longer than 32 bytes", () => {
    expect(() =>
      createIOUMessage({
        vault,
        sender: sender.publicKey,
        recipient: recipient.publicKey,
        tokenMint,
        amount: 100n,
        nonce: 1,
        sgtMint,
        memo: "this is a very long memo that exceeds 32 bytes limit for sure",
      })
    ).toThrow("Memo exceeds 32 bytes");
  });

  it("rejects wrong-size data in parseIOUMessage", () => {
    expect(() => parseIOUMessage(new Uint8Array(100))).toThrow(
      "Expected 217 bytes"
    );
  });

  it("rejects wrong version in parseIOUMessage", () => {
    const message = createIOUMessage({
      vault,
      sender: sender.publicKey,
      recipient: recipient.publicKey,
      tokenMint,
      amount: 100n,
      nonce: 1,
      sgtMint,
    });

    // Corrupt version byte
    const corrupted = new Uint8Array(message);
    corrupted[0] = 99;

    expect(() => parseIOUMessage(corrupted)).toThrow("Invalid IOU message version");
  });

  it("serialization is deterministic", () => {
    const params = {
      vault,
      sender: sender.publicKey,
      recipient: recipient.publicKey,
      tokenMint,
      amount: 123456789n,
      nonce: 7,
      sgtMint,
      expiry: 1700000000,
      memo: "chai x2",
    };

    const msg1 = createIOUMessage(params);
    const msg2 = createIOUMessage(params);

    expect(Buffer.from(msg1).equals(Buffer.from(msg2))).toBe(true);
  });
});
