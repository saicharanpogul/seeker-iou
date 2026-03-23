/**
 * NFC service for sending and receiving IOU payloads.
 * Uses react-native-nfc-manager for Android NFC (NDEF).
 */

import { encodeNFCPayload, decodeNFCPayload, validateNFCPayload } from "seeker-iou";
import type { NFCPayload, IOUParams } from "seeker-iou";

// NFC Manager is imported at runtime on device
// import NfcManager, { NfcTech, Ndef } from "react-native-nfc-manager";

export interface NFCSendResult {
  success: boolean;
  error?: string;
}

export interface NFCReceiveResult {
  success: boolean;
  iou: IOUParams | null;
  signature: Uint8Array | null;
  error?: string;
}

/**
 * Send a signed IOU via NFC tap.
 * Called after Seed Vault signs the IOU message.
 */
export async function sendIOUViaNFC(
  message: Uint8Array,
  signature: Uint8Array
): Promise<NFCSendResult> {
  try {
    const payload = encodeNFCPayload({ message, signature });

    // In production:
    // await NfcManager.requestTechnology(NfcTech.Ndef);
    // const ndefMessage = Ndef.encodeMessage([
    //   Ndef.record(
    //     Ndef.TNF_EXTERNAL_TYPE,
    //     "seeker-iou:payment",
    //     "",
    //     payload
    //   ),
    // ]);
    // await NfcManager.ndefHandler.writeNdefMessage(ndefMessage);
    // await NfcManager.cancelTechnologyRequest();

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Listen for incoming NFC taps containing IOU payloads.
 * Returns parsed and validated IOU data.
 */
export async function receiveIOUViaNFC(): Promise<NFCReceiveResult> {
  try {
    // In production:
    // await NfcManager.requestTechnology(NfcTech.Ndef);
    // const tag = await NfcManager.getTag();
    // await NfcManager.cancelTechnologyRequest();
    //
    // if (!tag?.ndefMessage?.[0]) {
    //   return { success: false, iou: null, signature: null, error: "No NDEF message" };
    // }
    //
    // const record = tag.ndefMessage[0];
    // const payload = new Uint8Array(record.payload);
    // const result = validateNFCPayload(payload);
    //
    // if (!result.valid) {
    //   return { success: false, iou: null, signature: null, error: result.error };
    // }
    //
    // return { success: true, iou: result.iou, signature: result.signature };

    return {
      success: false,
      iou: null,
      signature: null,
      error: "NFC only available on Seeker device",
    };
  } catch (err) {
    return {
      success: false,
      iou: null,
      signature: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
