import { IOUParams, NFCPayload } from "./types";
import {
  IOU_MESSAGE_SIZE,
  IOU_SIGNATURE_SIZE,
  NFC_PAYLOAD_SIZE,
  IOU_VERSION,
} from "./constants";
import { InvalidNFCPayloadError, SerializationError } from "./errors";
import { parseIOUMessage } from "./iou";

// NDEF Record Type Name Format: external type
const NDEF_TNF_EXTERNAL = 0x04;
const NDEF_TYPE = "seeker-iou:payment";

/**
 * Encode an IOU message + signature into an NDEF-compatible payload.
 * Format: [message (217 bytes)] [signature (64 bytes)]
 * Wrapped in NDEF record structure.
 */
export function encodeNFCPayload(payload: NFCPayload): Uint8Array {
  if (payload.message.length !== IOU_MESSAGE_SIZE) {
    throw new SerializationError(
      `Message must be ${IOU_MESSAGE_SIZE} bytes, got ${payload.message.length}`
    );
  }
  if (payload.signature.length !== IOU_SIGNATURE_SIZE) {
    throw new SerializationError(
      `Signature must be ${IOU_SIGNATURE_SIZE} bytes, got ${payload.signature.length}`
    );
  }

  const typeBytes = Buffer.from(NDEF_TYPE, "utf-8");

  // NDEF record:
  // [flags (1)] [type_length (1)] [payload_length (4)] [type (N)] [payload (M)]
  const flags = 0xc0 | NDEF_TNF_EXTERNAL; // MB=1, ME=1, SR=0, TNF=external
  const payloadBytes = Buffer.alloc(NFC_PAYLOAD_SIZE);
  Buffer.from(payload.message).copy(payloadBytes, 0);
  Buffer.from(payload.signature).copy(payloadBytes, IOU_MESSAGE_SIZE);

  const record = Buffer.alloc(
    1 + 1 + 4 + typeBytes.length + payloadBytes.length
  );
  let offset = 0;

  record.writeUInt8(flags, offset);
  offset += 1;

  record.writeUInt8(typeBytes.length, offset);
  offset += 1;

  record.writeUInt32BE(payloadBytes.length, offset);
  offset += 4;

  typeBytes.copy(record, offset);
  offset += typeBytes.length;

  payloadBytes.copy(record, offset);

  return new Uint8Array(record);
}

/**
 * Decode received NFC bytes back to IOU + signature.
 */
export function decodeNFCPayload(data: Uint8Array): NFCPayload {
  const buf = Buffer.from(data);

  if (buf.length < 6) {
    throw new InvalidNFCPayloadError("Data too short for NDEF header");
  }

  let offset = 0;

  const flags = buf.readUInt8(offset);
  offset += 1;
  const tnf = flags & 0x07;
  if (tnf !== NDEF_TNF_EXTERNAL) {
    throw new InvalidNFCPayloadError(`Unexpected TNF: ${tnf}`);
  }

  const typeLength = buf.readUInt8(offset);
  offset += 1;

  const payloadLength = buf.readUInt32BE(offset);
  offset += 4;

  if (buf.length < offset + typeLength + payloadLength) {
    throw new InvalidNFCPayloadError("Data shorter than declared lengths");
  }

  const type = buf.subarray(offset, offset + typeLength).toString("utf-8");
  offset += typeLength;

  if (type !== NDEF_TYPE) {
    throw new InvalidNFCPayloadError(`Unexpected NDEF type: ${type}`);
  }

  if (payloadLength !== NFC_PAYLOAD_SIZE) {
    throw new InvalidNFCPayloadError(
      `Expected payload of ${NFC_PAYLOAD_SIZE} bytes, got ${payloadLength}`
    );
  }

  const message = new Uint8Array(
    buf.subarray(offset, offset + IOU_MESSAGE_SIZE)
  );
  const signature = new Uint8Array(
    buf.subarray(offset + IOU_MESSAGE_SIZE, offset + NFC_PAYLOAD_SIZE)
  );

  return { message, signature };
}

/**
 * Validate a received NFC payload: check structure, version, and deserialize.
 */
export function validateNFCPayload(data: Uint8Array): {
  valid: boolean;
  iou: IOUParams | null;
  signature: Uint8Array | null;
  error: string | null;
} {
  try {
    const { message, signature } = decodeNFCPayload(data);

    // Check version byte
    if (message[0] !== IOU_VERSION) {
      return {
        valid: false,
        iou: null,
        signature: null,
        error: `Unsupported IOU version: ${message[0]}`,
      };
    }

    const iou = parseIOUMessage(message);
    return { valid: true, iou, signature, error: null };
  } catch (err) {
    return {
      valid: false,
      iou: null,
      signature: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
