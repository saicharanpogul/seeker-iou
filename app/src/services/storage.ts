import { MMKV } from "react-native-mmkv";
import {
  serializeLocalState,
  deserializeLocalState,
  type LocalVaultState,
  type ReceivedIOU,
} from "seeker-iou";

const storage = new MMKV({ id: "seeker-iou-storage" });

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
  storage.set(KEYS.VAULT_STATE, Buffer.from(bytes).toString("base64"));
}

export function loadVaultState(): LocalVaultState | null {
  const encoded = storage.getString(KEYS.VAULT_STATE);
  if (!encoded) return null;
  try {
    const bytes = new Uint8Array(Buffer.from(encoded, "base64"));
    return deserializeLocalState(bytes);
  } catch {
    return null;
  }
}

// --- Received IOUs ---

export function saveReceivedIOUs(ious: ReceivedIOU[]): void {
  const json = JSON.stringify(ious, (_, value) => {
    if (typeof value === "bigint") return { __bigint: value.toString() };
    if (value instanceof Uint8Array)
      return { __uint8array: Array.from(value) };
    return value;
  });
  storage.set(KEYS.RECEIVED_IOUS, json);
}

export function loadReceivedIOUs(): ReceivedIOU[] {
  const json = storage.getString(KEYS.RECEIVED_IOUS);
  if (!json) return [];
  try {
    return JSON.parse(json, (_, value) => {
      if (value && typeof value === "object") {
        if ("__bigint" in value) return BigInt(value.__bigint);
        if ("__uint8array" in value)
          return new Uint8Array(value.__uint8array);
      }
      return value;
    });
  } catch {
    return [];
  }
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
  storage.set(KEYS.WALLET_PUBKEY, pubkey);
}

export function loadWalletPubkey(): string | null {
  return storage.getString(KEYS.WALLET_PUBKEY) ?? null;
}

export function saveSgtMint(mint: string): void {
  storage.set(KEYS.SGT_MINT, mint);
}

export function loadSgtMint(): string | null {
  return storage.getString(KEYS.SGT_MINT) ?? null;
}

export function saveTokenMint(mint: string): void {
  storage.set(KEYS.TOKEN_MINT, mint);
}

export function loadTokenMint(): string | null {
  return storage.getString(KEYS.TOKEN_MINT) ?? null;
}

export function clearAll(): void {
  storage.clearAll();
}
