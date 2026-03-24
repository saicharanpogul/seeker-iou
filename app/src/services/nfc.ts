import {
  encodeNFCPayload,
  decodeNFCPayload,
  validateNFCPayload,
  createIOUMessage,
  deriveVaultPda,
  IOU_MESSAGE_SIZE,
} from "seeker-iou";
import { Keypair, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import type { IOUParams } from "seeker-iou";
import { DEV_MODE, mockDelay } from "./devMode";

export interface NFCReceiveResult {
  success: boolean;
  iou: IOUParams | null;
  signature: Uint8Array | null;
  rawMessage: Uint8Array | null;
  error?: string;
}

// --- Dev mode: simulated NFC "inbox" ---
// When sendIOUViaNFC is called in dev mode, it stores the payload here.
// When receiveIOUViaNFC is called, it reads from here (simulating a tap).
let devNFCBuffer: { message: Uint8Array; signature: Uint8Array } | null = null;

/**
 * In dev mode, simulate receiving an IOU from a fake sender.
 * Call this to pre-load the NFC buffer for testing the receive flow.
 */
export function devSimulateIncomingIOU(params?: {
  senderKeypair?: Keypair;
  recipientPubkey?: PublicKey;
  amount?: bigint;
}): void {
  if (!DEV_MODE) return;

  const sender = params?.senderKeypair || Keypair.generate();
  const recipient = params?.recipientPubkey || Keypair.generate().publicKey;
  const tokenMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // USDC devnet
  const sgtMint = Keypair.generate().publicKey;
  const [vault] = deriveVaultPda(sender.publicKey, tokenMint);

  const message = createIOUMessage({
    vault,
    sender: sender.publicKey,
    recipient,
    tokenMint,
    amount: params?.amount || 5_000_000n, // 5 USDC
    nonce: Math.floor(Math.random() * 1000) + 1,
    sgtMint,
    memo: "dev test payment",
  });

  const signature = nacl.sign.detached(message, sender.secretKey);

  devNFCBuffer = { message, signature };
  console.log("[DEV] Simulated incoming IOU loaded into NFC buffer");
  console.log("[DEV]   From:", sender.publicKey.toBase58().slice(0, 8) + "...");
  console.log("[DEV]   Amount:", (params?.amount || 5_000_000n).toString());
}

/**
 * Initialize NFC.
 * DEV: always returns true.
 * PROD: checks hardware NFC support.
 */
export async function initNFC(): Promise<boolean> {
  if (DEV_MODE) {
    console.log("[DEV] NFC initialized (mock)");
    return true;
  }

  const NfcManager = (await import("react-native-nfc-manager")).default;
  const supported = await NfcManager.isSupported();
  if (supported) await NfcManager.start();
  return supported;
}

/**
 * Send a signed IOU via NFC.
 * DEV: stores in buffer (simulates NFC push).
 * PROD: writes NDEF record via NFC hardware.
 */
export async function sendIOUViaNFC(
  message: Uint8Array,
  signature: Uint8Array
): Promise<{ success: boolean; error?: string }> {
  if (DEV_MODE) {
    await mockDelay(1000);
    devNFCBuffer = { message, signature };
    console.log("[DEV] IOU sent via mock NFC");
    return { success: true };
  }

  try {
    const NfcManager = (await import("react-native-nfc-manager")).default;
    const { NfcTech, Ndef } = await import("react-native-nfc-manager");
    const payload = encodeNFCPayload({ message, signature });

    await NfcManager.requestTechnology(NfcTech.Ndef);
    await NfcManager.ndefHandler.writeNdefMessage([
      Ndef.record(Ndef.TNF_EXTERNAL_TYPE, "seeker-iou:payment", "", Array.from(payload)),
    ]);
    await NfcManager.cancelTechnologyRequest();
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Receive an IOU via NFC.
 * DEV: reads from buffer (with simulated delay for "tap" feel).
 *      If buffer is empty, auto-generates a fake incoming IOU.
 * PROD: blocks until NFC tag detected, reads NDEF.
 */
export async function receiveIOUViaNFC(): Promise<NFCReceiveResult> {
  if (DEV_MODE) {
    // Simulate waiting for a tap
    await mockDelay(2000);

    // If nothing in buffer, generate a fake incoming IOU
    if (!devNFCBuffer) {
      devSimulateIncomingIOU();
    }

    const buf = devNFCBuffer!;
    devNFCBuffer = null;

    // Encode then decode to exercise the full pipeline
    const encoded = encodeNFCPayload(buf);
    const result = validateNFCPayload(encoded);

    if (!result.valid) {
      return { success: false, iou: null, signature: null, rawMessage: null, error: result.error || "Invalid" };
    }

    const decoded = decodeNFCPayload(encoded);
    console.log("[DEV] IOU received via mock NFC");
    return {
      success: true,
      iou: result.iou,
      signature: result.signature,
      rawMessage: decoded.message,
    };
  }

  // Production NFC
  try {
    const NfcManager = (await import("react-native-nfc-manager")).default;
    const { NfcTech } = await import("react-native-nfc-manager");
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    await NfcManager.cancelTechnologyRequest();

    if (!tag?.ndefMessage?.[0]?.payload) {
      return { success: false, iou: null, signature: null, rawMessage: null, error: "No NDEF message" };
    }

    const payload = new Uint8Array(tag.ndefMessage[0].payload);
    const result = validateNFCPayload(payload);
    if (!result.valid) {
      return { success: false, iou: null, signature: null, rawMessage: null, error: result.error || "Invalid" };
    }

    const decoded = decodeNFCPayload(payload);
    return { success: true, iou: result.iou, signature: result.signature, rawMessage: decoded.message };
  } catch (err) {
    return { success: false, iou: null, signature: null, rawMessage: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelNFC(): Promise<void> {
  if (DEV_MODE) return;
  try {
    const NfcManager = (await import("react-native-nfc-manager")).default;
    await NfcManager.cancelTechnologyRequest();
  } catch {}
}
