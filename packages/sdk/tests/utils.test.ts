import { describe, it, expect } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  deriveVaultPda,
  deriveSettlementRecordPda,
  deriveReputationPda,
  formatAmount,
  parseAmount,
} from "../src/utils";
import { PROGRAM_ID } from "../src/constants";

describe("PDA derivation", () => {
  it("derives vault PDA deterministically", () => {
    const owner = Keypair.generate().publicKey;
    const tokenMint = Keypair.generate().publicKey;

    const [pda1, bump1] = deriveVaultPda(owner, tokenMint);
    const [pda2, bump2] = deriveVaultPda(owner, tokenMint);

    expect(pda1.toBase58()).toBe(pda2.toBase58());
    expect(bump1).toBe(bump2);
  });

  it("different owners produce different vault PDAs", () => {
    const owner1 = Keypair.generate().publicKey;
    const owner2 = Keypair.generate().publicKey;
    const tokenMint = Keypair.generate().publicKey;

    const [pda1] = deriveVaultPda(owner1, tokenMint);
    const [pda2] = deriveVaultPda(owner2, tokenMint);

    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  it("derives settlement record PDA deterministically", () => {
    const vault = Keypair.generate().publicKey;

    const [pda1] = deriveSettlementRecordPda(vault, 1);
    const [pda2] = deriveSettlementRecordPda(vault, 1);

    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it("different nonces produce different settlement PDAs", () => {
    const vault = Keypair.generate().publicKey;

    const [pda1] = deriveSettlementRecordPda(vault, 1);
    const [pda2] = deriveSettlementRecordPda(vault, 2);

    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  it("derives reputation PDA deterministically", () => {
    const sgtMint = Keypair.generate().publicKey;

    const [pda1] = deriveReputationPda(sgtMint);
    const [pda2] = deriveReputationPda(sgtMint);

    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });
});

describe("amount formatting", () => {
  it("formats whole amounts", () => {
    expect(formatAmount(1_000_000_000n, 9)).toBe("1");
    expect(formatAmount(5_000_000_000n, 9)).toBe("5");
  });

  it("formats fractional amounts", () => {
    expect(formatAmount(1_500_000_000n, 9)).toBe("1.5");
    expect(formatAmount(1_230_000_000n, 9)).toBe("1.23");
  });

  it("formats zero", () => {
    expect(formatAmount(0n, 9)).toBe("0");
  });

  it("parses formatted amounts back", () => {
    expect(parseAmount("1.5", 9)).toBe(1_500_000_000n);
    expect(parseAmount("1", 9)).toBe(1_000_000_000n);
    expect(parseAmount("0.001", 9)).toBe(1_000_000n);
  });
});
