import { LocalVaultState, PendingIOU } from "./types";
import { InsufficientBalanceError, SerializationError } from "./errors";

/**
 * Track a newly issued IOU in local vault state.
 * Called after signing and NFC transfer.
 */
export function trackIssuedIOU(
  state: LocalVaultState,
  iou: PendingIOU
): LocalVaultState {
  const newSpentAmount = state.spentAmount + iou.amount;
  const available = state.depositedAmount - newSpentAmount;
  if (available < 0n) {
    throw new InsufficientBalanceError();
  }

  return {
    ...state,
    spentAmount: newSpentAmount,
    currentNonce: iou.nonce,
    pendingIOUs: [...state.pendingIOUs, iou],
  };
}

/**
 * Get remaining issuable balance from local state.
 */
export function getLocalAvailableBalance(state: LocalVaultState): bigint {
  return state.depositedAmount - state.spentAmount;
}

/**
 * Serialize local vault state for device storage.
 * Format: JSON-encoded with bigint as strings, then UTF-8 bytes.
 */
export function serializeLocalState(state: LocalVaultState): Uint8Array {
  const json = JSON.stringify(state, (_, value) => {
    if (typeof value === "bigint") {
      return { __bigint: value.toString() };
    }
    if (value instanceof Uint8Array) {
      return { __uint8array: Array.from(value) };
    }
    return value;
  });
  return new TextEncoder().encode(json);
}

/**
 * Deserialize local vault state from device storage.
 */
export function deserializeLocalState(data: Uint8Array): LocalVaultState {
  const json = new TextDecoder().decode(data);
  try {
    return JSON.parse(json, (_, value) => {
      if (value && typeof value === "object") {
        if ("__bigint" in value) {
          return BigInt(value.__bigint);
        }
        if ("__uint8array" in value) {
          return new Uint8Array(value.__uint8array);
        }
      }
      return value;
    });
  } catch (err) {
    throw new SerializationError(
      `Failed to deserialize local state: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
