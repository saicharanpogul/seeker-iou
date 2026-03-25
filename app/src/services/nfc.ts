import {
  encodeNFCPayload,
  decodeNFCPayload,
  validateNFCPayload,
  createIOUMessage,
  deriveVaultPda,
} from "seeker-iou";
import { Keypair, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import type { IOUParams } from "seeker-iou";
import { isDevMode, mockDelay } from "./devMode";

export interface NFCReceiveResult {
  success: boolean;
  iou: IOUParams | null;
  signature: Uint8Array | null;
  rawMessage: Uint8Array | null;
  error?: string;
}

// Dev mode NFC buffer
let devNFCBuffer: { message: Uint8Array; signature: Uint8Array } | null = null;

// Lazy NFC manager reference
let _nfcManager: any = null;
let _nfcStarted = false;

async function getNfcManager(): Promise<any> {
  if (_nfcManager) return _nfcManager;
  try {
    const mod = require("react-native-nfc-manager");
    _nfcManager = mod.default;
    return _nfcManager;
  } catch (err) {
    throw new Error("NFC not available: " + (err instanceof Error ? err.message : String(err)));
  }
}

function getNfcTech(): any {
  return require("react-native-nfc-manager").NfcTech;
}

function getNdef(): any {
  return require("react-native-nfc-manager").Ndef;
}

export function devSimulateIncomingIOU(params?: {
  senderKeypair?: Keypair;
  recipientPubkey?: PublicKey;
  amount?: bigint;
}): void {
  if (!isDevMode()) return;
  const sender = params?.senderKeypair || Keypair.generate();
  const recipient = params?.recipientPubkey || Keypair.generate().publicKey;
  const tokenMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
  const sgtMint = Keypair.generate().publicKey;
  const [vault] = deriveVaultPda(sender.publicKey, tokenMint);

  const message = createIOUMessage({
    vault,
    sender: sender.publicKey,
    recipient,
    tokenMint,
    amount: params?.amount || 5_000_000n,
    nonce: Math.floor(Math.random() * 1000) + 1,
    sgtMint,
    memo: "dev test payment",
  });

  const signature = nacl.sign.detached(message, sender.secretKey);
  devNFCBuffer = { message, signature };
}

/**
 * Initialize NFC. Must be called once on app startup.
 */
export async function initNFC(): Promise<boolean> {
  if (isDevMode()) return true;

  try {
    const mgr = await getNfcManager();
    const supported = await mgr.isSupported();
    if (supported) {
      await mgr.start();
      _nfcStarted = true;
    }
    return supported;
  } catch (err) {
    console.warn("NFC init failed:", err);
    return false;
  }
}

/**
 * Send a signed IOU via NFC.
 */
export async function sendIOUViaNFC(
  message: Uint8Array,
  signature: Uint8Array
): Promise<{ success: boolean; error?: string }> {
  if (isDevMode()) {
    await mockDelay(1000);
    devNFCBuffer = { message, signature };
    return { success: true };
  }

  try {
    const mgr = await getNfcManager();
    if (!_nfcStarted) {
      await mgr.start();
      _nfcStarted = true;
    }

    const NfcTech = getNfcTech();
    const Ndef = getNdef();
    const payload = encodeNFCPayload({ message, signature });

    await mgr.requestTechnology(NfcTech.Ndef);
    await mgr.ndefHandler.writeNdefMessage([
      Ndef.record(Ndef.TNF_EXTERNAL_TYPE, "seeker-iou:payment", "", Array.from(payload)),
    ]);
    await mgr.cancelTechnologyRequest();
    return { success: true };
  } catch (err) {
    try { (await getNfcManager()).cancelTechnologyRequest(); } catch {}
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Receive an IOU via NFC.
 * Activates NFC reader mode and waits for a tap.
 */
export async function receiveIOUViaNFC(): Promise<NFCReceiveResult> {
  if (isDevMode()) {
    await mockDelay(2000);
    if (!devNFCBuffer) devSimulateIncomingIOU();
    const buf = devNFCBuffer!;
    devNFCBuffer = null;

    const encoded = encodeNFCPayload(buf);
    const result = validateNFCPayload(encoded);
    if (!result.valid) {
      return { success: false, iou: null, signature: null, rawMessage: null, error: result.error || "Invalid" };
    }
    const decoded = decodeNFCPayload(encoded);
    return { success: true, iou: result.iou, signature: result.signature, rawMessage: decoded.message };
  }

  // Production NFC — activate reader and wait for tag
  try {
    const mgr = await getNfcManager();
    if (!_nfcStarted) {
      await mgr.start();
      _nfcStarted = true;
    }

    const NfcTech = getNfcTech();
    await mgr.requestTechnology(NfcTech.Ndef);
    const tag = await mgr.getTag();
    await mgr.cancelTechnologyRequest();

    if (!tag?.ndefMessage || tag.ndefMessage.length === 0) {
      return { success: false, iou: null, signature: null, rawMessage: null, error: "No NDEF message on tag" };
    }

    // Find seeker-iou payment record
    const NDEF_TYPE = "seeker-iou:payment";
    const record = tag.ndefMessage.find((r: any) => {
      const type = r.type ? String.fromCharCode(...r.type) : "";
      return type === NDEF_TYPE;
    });

    if (!record?.payload) {
      return { success: false, iou: null, signature: null, rawMessage: null, error: "No seeker-iou record" };
    }

    const payload = new Uint8Array(record.payload);
    const result = validateNFCPayload(payload);
    if (!result.valid) {
      return { success: false, iou: null, signature: null, rawMessage: null, error: result.error || "Invalid" };
    }

    const decoded = decodeNFCPayload(payload);
    return { success: true, iou: result.iou, signature: result.signature, rawMessage: decoded.message };
  } catch (err) {
    try { (await getNfcManager()).cancelTechnologyRequest(); } catch {}
    return { success: false, iou: null, signature: null, rawMessage: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelNFC(): Promise<void> {
  if (isDevMode()) return;
  try { (await getNfcManager()).cancelTechnologyRequest(); } catch {}
}
