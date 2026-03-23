import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "Appq4U1rTS4tCo4E84qhQs777z3awXf6K55amgnZ5srC"
);

export const SGT_MINT_AUTHORITY = new PublicKey(
  "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4"
);

export const VAULT_SEED = Buffer.from("vault");
export const SETTLEMENT_SEED = Buffer.from("settlement");
export const REPUTATION_SEED = Buffer.from("reputation");

export const IOU_MESSAGE_SIZE = 217;
export const IOU_SIGNATURE_SIZE = 64;
export const NFC_PAYLOAD_SIZE = IOU_MESSAGE_SIZE + IOU_SIGNATURE_SIZE; // 281

export const IOU_VERSION = 1;

export const DEFAULT_COOLDOWN_SECONDS = 3600;
