// Constants
export {
  PROGRAM_ID,
  SGT_MINT_AUTHORITY,
  VAULT_SEED,
  SETTLEMENT_SEED,
  REPUTATION_SEED,
  IOU_MESSAGE_SIZE,
  IOU_SIGNATURE_SIZE,
  NFC_PAYLOAD_SIZE,
  IOU_VERSION,
  DEFAULT_COOLDOWN_SECONDS,
} from "./constants";

// Types
export type {
  VaultAccount,
  SettlementRecord,
  ReputationAccount,
  IOUParams,
  NFCPayload,
  LocalVaultState,
  PendingIOU,
  ReceivedIOU,
  RiskConfig,
} from "./types";

// Errors
export {
  SeekerIOUError,
  InvalidIOUVersionError,
  InvalidSignatureError,
  InvalidNFCPayloadError,
  InvalidMemoError,
  InsufficientBalanceError,
  SerializationError,
} from "./errors";

// Utils
export {
  deriveVaultPda,
  deriveSettlementRecordPda,
  deriveReputationPda,
  formatAmount,
  parseAmount,
} from "./utils";

// IOU
export { createIOUMessage, parseIOUMessage, verifyIOUSignature } from "./iou";

// NFC
export {
  encodeNFCPayload,
  decodeNFCPayload,
  validateNFCPayload,
} from "./nfc";

// Verification
export { verifySignature } from "./verification";

// Vault instructions
export {
  createVaultInstruction,
  createDepositInstruction,
  createDeactivateVaultInstruction,
  createReactivateVaultInstruction,
  createWithdrawInstruction,
} from "./vault";

// Settlement instructions
export {
  createSettleIOUInstruction,
  createBatchSettleInstructions,
  chunkSettlementTransactions,
} from "./settlement";

// Reputation
export {
  getReputation,
  calculateTrustScore,
  getSettlementHistory,
} from "./reputation";

// Local state
export {
  trackIssuedIOU,
  getLocalAvailableBalance,
  serializeLocalState,
  deserializeLocalState,
} from "./local-state";
