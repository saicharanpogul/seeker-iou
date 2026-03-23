import { describe, it, expect } from "vitest";
import {
  trackIssuedIOU,
  getLocalAvailableBalance,
  serializeLocalState,
  deserializeLocalState,
} from "../src/local-state";
import { LocalVaultState, PendingIOU } from "../src/types";

describe("local state management", () => {
  const initialState: LocalVaultState = {
    vaultAddress: "vault123",
    tokenMint: "mint456",
    depositedAmount: 1_000_000_000n,
    spentAmount: 0n,
    currentNonce: 0,
    pendingIOUs: [],
  };

  it("tracks issued IOU and decrements balance", () => {
    const iou: PendingIOU = {
      recipient: "recipient1",
      amount: 100_000_000n,
      nonce: 1,
      message: new Uint8Array(217),
      signature: new Uint8Array(64),
      createdAt: Date.now(),
      settled: false,
    };

    const newState = trackIssuedIOU(initialState, iou);

    expect(newState.spentAmount).toBe(100_000_000n);
    expect(newState.currentNonce).toBe(1);
    expect(newState.pendingIOUs).toHaveLength(1);
    expect(getLocalAvailableBalance(newState)).toBe(900_000_000n);
  });

  it("tracks multiple IOUs", () => {
    let state = initialState;

    for (let i = 1; i <= 5; i++) {
      state = trackIssuedIOU(state, {
        recipient: `recipient${i}`,
        amount: 100_000_000n,
        nonce: i,
        message: new Uint8Array(217),
        signature: new Uint8Array(64),
        createdAt: Date.now(),
        settled: false,
      });
    }

    expect(state.spentAmount).toBe(500_000_000n);
    expect(state.currentNonce).toBe(5);
    expect(state.pendingIOUs).toHaveLength(5);
    expect(getLocalAvailableBalance(state)).toBe(500_000_000n);
  });

  it("throws on insufficient balance", () => {
    expect(() =>
      trackIssuedIOU(initialState, {
        recipient: "recipient1",
        amount: 2_000_000_000n,
        nonce: 1,
        message: new Uint8Array(217),
        signature: new Uint8Array(64),
        createdAt: Date.now(),
        settled: false,
      })
    ).toThrow("Insufficient local vault balance");
  });

  it("serialization roundtrip preserves state", () => {
    const stateWithIOUs = trackIssuedIOU(initialState, {
      recipient: "recipient1",
      amount: 100_000_000n,
      nonce: 1,
      message: new Uint8Array(217).fill(0xaa),
      signature: new Uint8Array(64).fill(0xbb),
      createdAt: 1700000000,
      settled: false,
    });

    const serialized = serializeLocalState(stateWithIOUs);
    const deserialized = deserializeLocalState(serialized);

    expect(deserialized.vaultAddress).toBe("vault123");
    expect(deserialized.tokenMint).toBe("mint456");
    expect(deserialized.depositedAmount).toBe(1_000_000_000n);
    expect(deserialized.spentAmount).toBe(100_000_000n);
    expect(deserialized.currentNonce).toBe(1);
    expect(deserialized.pendingIOUs).toHaveLength(1);
    expect(deserialized.pendingIOUs[0].amount).toBe(100_000_000n);
    expect(deserialized.pendingIOUs[0].message[0]).toBe(0xaa);
    expect(deserialized.pendingIOUs[0].signature[0]).toBe(0xbb);
  });
});
