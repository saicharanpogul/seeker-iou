import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { calculateTrustScore } from "../src/reputation";
import { ReputationAccount } from "../src/types";

function makeReputation(
  settled: bigint,
  failed: bigint
): ReputationAccount {
  return {
    sgtMint: PublicKey.default,
    totalIssued: settled + failed,
    totalSettled: settled,
    totalFailed: failed,
    totalVolume: settled * 1000000n,
    lastFailureAt: failed > 0n ? 1700000000n : 0n,
    createdAt: 1700000000n,
    bump: 255,
  };
}

describe("trust score calculation", () => {
  it("returns 1.0 for zero settlements", () => {
    const reputation = makeReputation(0n, 0n);
    expect(calculateTrustScore(reputation)).toBe(1.0);
  });

  it("returns 1.0 for all successful", () => {
    const reputation = makeReputation(100n, 0n);
    expect(calculateTrustScore(reputation)).toBe(1.0);
  });

  it("returns 0.0 for all failed", () => {
    const reputation = makeReputation(0n, 10n);
    expect(calculateTrustScore(reputation)).toBe(0.0);
  });

  it("calculates mixed correctly", () => {
    const reputation = makeReputation(95n, 5n);
    expect(calculateTrustScore(reputation)).toBe(0.95);
  });

  it("handles large numbers", () => {
    const reputation = makeReputation(999999n, 1n);
    const score = calculateTrustScore(reputation);
    expect(score).toBeGreaterThan(0.999);
    expect(score).toBeLessThan(1.0);
  });
});
