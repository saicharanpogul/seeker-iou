import NfcManager, { NfcTech, Ndef, NfcEvents } from "react-native-nfc-manager";
import {
  encodeNFCPayload,
  decodeNFCPayload,
  validateNFCPayload,
} from "seeker-iou";
import type { IOUParams } from "seeker-iou";

const NDEF_TYPE = "seeker-iou:payment";

export interface NFCReceiveResult {
  success: boolean;
  iou: IOUParams | null;
  signature: Uint8Array | null;
  rawMessage: Uint8Array | null;
  error?: string;
}

/**
 * Initialize NFC manager. Call once on app startup.
 */
export async function initNFC(): Promise<boolean> {
  const supported = await NfcManager.isSupported();
  if (supported) {
    await NfcManager.start();
  }
  return supported;
}

/**
 * Send a signed IOU via NFC using Android Beam / NDEF push.
 * The sender holds their phone against the recipient's phone.
 *
 * Flow:
 * 1. Encode IOU message + signature into NDEF payload
 * 2. Set NDEF push message
 * 3. Wait for tap
 * 4. Message transfers to recipient's phone
 */
export async function sendIOUViaNFC(
  message: Uint8Array,
  signature: Uint8Array
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = encodeNFCPayload({ message, signature });

    await NfcManager.requestTechnology(NfcTech.Ndef);

    const bytes = Array.from(payload);
    const ndefRecords = [
      Ndef.record(
        Ndef.TNF_EXTERNAL_TYPE,
        NDEF_TYPE,
        "",
        bytes
      ),
    ];

    await NfcManager.ndefHandler.writeNdefMessage(ndefRecords);
    await NfcManager.cancelTechnologyRequest();

    return { success: true };
  } catch (err) {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {}
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Listen for incoming NFC tap containing an IOU payment.
 * Returns a promise that resolves when a valid IOU is received.
 *
 * Flow:
 * 1. Enable NFC reader mode
 * 2. Wait for tag discovery
 * 3. Read NDEF message
 * 4. Decode and validate the IOU payload
 * 5. Return parsed IOU + signature
 */
export async function receiveIOUViaNFC(): Promise<NFCReceiveResult> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);

    const tag = await NfcManager.getTag();
    await NfcManager.cancelTechnologyRequest();

    if (!tag?.ndefMessage || tag.ndefMessage.length === 0) {
      return {
        success: false,
        iou: null,
        signature: null,
        rawMessage: null,
        error: "No NDEF message found on tag",
      };
    }

    // Find the seeker-iou payment record
    const record = tag.ndefMessage.find((r) => {
      const type = String.fromCharCode(...(r.type || []));
      return type === NDEF_TYPE;
    });

    if (!record || !record.payload) {
      return {
        success: false,
        iou: null,
        signature: null,
        rawMessage: null,
        error: "No seeker-iou payment record found",
      };
    }

    const payload = new Uint8Array(record.payload);
    const result = validateNFCPayload(payload);

    if (!result.valid || !result.iou || !result.signature) {
      return {
        success: false,
        iou: null,
        signature: null,
        rawMessage: null,
        error: result.error || "Invalid NFC payload",
      };
    }

    // Extract the raw message bytes from the decoded payload
    const decoded = decodeNFCPayload(payload);

    return {
      success: true,
      iou: result.iou,
      signature: result.signature,
      rawMessage: decoded.message,
    };
  } catch (err) {
    try {
      await NfcManager.cancelTechnologyRequest();
    } catch {}
    return {
      success: false,
      iou: null,
      signature: null,
      rawMessage: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Cancel any pending NFC operation.
 */
export async function cancelNFC(): Promise<void> {
  try {
    await NfcManager.cancelTechnologyRequest();
  } catch {}
}

/**
 * Clean up NFC manager. Call on app shutdown.
 */
export async function cleanupNFC(): Promise<void> {
  await cancelNFC();
}
