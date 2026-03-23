/**
 * Local storage service using MMKV for fast key-value persistence.
 * Stores vault state, pending IOUs, and received IOUs.
 */

import {
  serializeLocalState,
  deserializeLocalState,
  type LocalVaultState,
  type ReceivedIOU,
} from "seeker-iou";

// import { MMKV } from "react-native-mmkv";
// const storage = new MMKV();

// Placeholder for non-device environments
const memoryStore = new Map<string, string>();

function getString(key: string): string | undefined {
  // return storage.getString(key);
  return memoryStore.get(key);
}

function setString(key: string, value: string): void {
  // storage.set(key, value);
  memoryStore.set(key, value);
}

const VAULT_STATE_KEY = "vault_state";
const RECEIVED_IOUS_KEY = "received_ious";

export function saveVaultState(state: LocalVaultState): void {
  const bytes = serializeLocalState(state);
  const encoded = Buffer.from(bytes).toString("base64");
  setString(VAULT_STATE_KEY, encoded);
}

export function loadVaultState(): LocalVaultState | null {
  const encoded = getString(VAULT_STATE_KEY);
  if (!encoded) return null;
  const bytes = new Uint8Array(Buffer.from(encoded, "base64"));
  return deserializeLocalState(bytes);
}

export function saveReceivedIOUs(ious: ReceivedIOU[]): void {
  const json = JSON.stringify(
    ious,
    (_, value) => {
      if (typeof value === "bigint") return { __bigint: value.toString() };
      if (value instanceof Uint8Array) return { __uint8array: Array.from(value) };
      return value;
    }
  );
  setString(RECEIVED_IOUS_KEY, json);
}

export function loadReceivedIOUs(): ReceivedIOU[] {
  const json = getString(RECEIVED_IOUS_KEY);
  if (!json) return [];
  return JSON.parse(json, (_, value) => {
    if (value && typeof value === "object") {
      if ("__bigint" in value) return BigInt(value.__bigint);
      if ("__uint8array" in value) return new Uint8Array(value.__uint8array);
    }
    return value;
  });
}

export function clearAll(): void {
  // storage.clearAll();
  memoryStore.clear();
}
