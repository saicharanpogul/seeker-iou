import { PublicKey } from "@solana/web3.js";
import {
  SGT_MINT_AUTHORITY as _SGT_MINT_AUTHORITY,
  SGT_METADATA_ADDRESS,
  SGT_GROUP_MINT_ADDRESS,
} from "seeker-sdk";

export const PROGRAM_ID = new PublicKey(
  "Appq4U1rTS4tCo4E84qhQs777z3awXf6K55amgnZ5srC"
);

/** SGT mint authority — sourced from seeker-sdk canonical constant */
export const SGT_MINT_AUTHORITY = _SGT_MINT_AUTHORITY;

/** SGT metadata address (also the group mint address) */
export { SGT_METADATA_ADDRESS, SGT_GROUP_MINT_ADDRESS };

export const VAULT_SEED = Buffer.from("vault");
export const SETTLEMENT_SEED = Buffer.from("settlement");
export const REPUTATION_SEED = Buffer.from("reputation");

export const IOU_MESSAGE_SIZE = 217;
export const IOU_SIGNATURE_SIZE = 64;
export const NFC_PAYLOAD_SIZE = IOU_MESSAGE_SIZE + IOU_SIGNATURE_SIZE; // 281

export const IOU_VERSION = 1;

export const DEFAULT_COOLDOWN_SECONDS = 3600;

export const MIN_COOLDOWN_SECONDS = 300;

export const MAX_RESERVE_RATIO_BPS = 10000;
