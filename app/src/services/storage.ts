import {
  serializeLocalState,
  deserializeLocalState,
  type LocalVaultState,
  type ReceivedIOU,
} from "seeker-iou";
import { isDevMode } from "./devMode";

// Storage backend: MMKV on device, Map in dev/simulator
interface KVStore {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  clearAll(): void;
}

let store: KVStore | null = null;
let storeIsDevMode: boolean | null = null;

/** Reset store when dev mode toggles */
export function resetStore(): void {
  store = null;
  storeIsDevMode = null;
}

function getStore(): KVStore {
  const currentDev = isDevMode();
  if (store && storeIsDevMode === currentDev) return store;

  storeIsDevMode = currentDev;
  if (currentDev) {
    // In-memory fallback for simulator
    const mem = new Map<string, string>();
    store = {
      getString: (k) => mem.get(k),
      set: (k, v) => mem.set(k, v),
      clearAll: () => mem.clear(),
    };
    console.log("[DEV] Using in-memory storage");
  } else {
    // MMKV on device
    const { MMKV } = require("react-native-mmkv");
    const mmkv = new MMKV({ id: "seeker-iou-storage" });
    store = {
      getString: (k: string) => mmkv.getString(k),
      set: (k: string, v: string) => mmkv.set(k, v),
      clearAll: () => mmkv.clearAll(),
    };
  }
  return store;
}

const KEYS = {
  VAULT_STATE: "vault_state",
  RECEIVED_IOUS: "received_ious",
  WALLET_PUBKEY: "wallet_pubkey",
  SGT_MINT: "sgt_mint",
  TOKEN_MINT: "token_mint",
} as const;

// --- Vault State ---

export function saveVaultState(state: LocalVaultState): void {
  const bytes = serializeLocalState(state);
  getStore().set(KEYS.VAULT_STATE, Buffer.from(bytes).toString("base64"));
}

export function loadVaultState(): LocalVaultState | null {
  const encoded = getStore().getString(KEYS.VAULT_STATE);
  if (!encoded) return null;
  try {
    const bytes = new Uint8Array(Buffer.from(encoded, "base64"));
    return deserializeLocalState(bytes);
  } catch {
    return null;
  }
}

// --- Received IOUs ---

function serializeIOUs(ious: ReceivedIOU[]): string {
  return JSON.stringify(ious, (_, value) => {
    if (typeof value === "bigint") return { __bigint: value.toString() };
    if (value instanceof Uint8Array) return { __uint8array: Array.from(value) };
    return value;
  });
}

function deserializeIOUs(json: string): ReceivedIOU[] {
  return JSON.parse(json, (_, value) => {
    if (value && typeof value === "object") {
      if ("__bigint" in value) return BigInt(value.__bigint);
      if ("__uint8array" in value) return new Uint8Array(value.__uint8array);
    }
    return value;
  });
}

export function saveReceivedIOUs(ious: ReceivedIOU[]): void {
  getStore().set(KEYS.RECEIVED_IOUS, serializeIOUs(ious));
}

export function loadReceivedIOUs(): ReceivedIOU[] {
  const json = getStore().getString(KEYS.RECEIVED_IOUS);
  if (!json) return [];
  try { return deserializeIOUs(json); } catch { return []; }
}

export function addReceivedIOU(iou: ReceivedIOU): void {
  const existing = loadReceivedIOUs();
  existing.push(iou);
  saveReceivedIOUs(existing);
}

export function markIOUSettled(nonce: number, txSig: string): void {
  const ious = loadReceivedIOUs();
  const iou = ious.find((i) => i.nonce === nonce);
  if (iou) {
    iou.settled = true;
    iou.settlementTx = txSig;
    saveReceivedIOUs(ious);
  }
}

// --- Config ---

export function saveWalletPubkey(pubkey: string): void {
  getStore().set(KEYS.WALLET_PUBKEY, pubkey);
}

export function loadWalletPubkey(): string | null {
  return getStore().getString(KEYS.WALLET_PUBKEY) ?? null;
}

export function saveSgtMint(mint: string): void {
  getStore().set(KEYS.SGT_MINT, mint);
}

export function loadSgtMint(): string | null {
  return getStore().getString(KEYS.SGT_MINT) ?? null;
}

export function saveTokenMint(mint: string): void {
  getStore().set(KEYS.TOKEN_MINT, mint);
}

export function loadTokenMint(): string | null {
  return getStore().getString(KEYS.TOKEN_MINT) ?? null;
}

export function clearAll(): void {
  getStore().clearAll();
}
