export class SeekerIOUError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "SeekerIOUError";
  }
}

export class InvalidIOUVersionError extends SeekerIOUError {
  constructor() {
    super("Invalid IOU message version", "INVALID_IOU_VERSION");
  }
}

export class InvalidSignatureError extends SeekerIOUError {
  constructor() {
    super("Invalid Ed25519 signature", "INVALID_SIGNATURE");
  }
}

export class InvalidNFCPayloadError extends SeekerIOUError {
  constructor(reason: string) {
    super(`Invalid NFC payload: ${reason}`, "INVALID_NFC_PAYLOAD");
  }
}

export class InvalidMemoError extends SeekerIOUError {
  constructor() {
    super("Memo exceeds 32 bytes", "INVALID_MEMO");
  }
}

export class InsufficientBalanceError extends SeekerIOUError {
  constructor() {
    super("Insufficient local vault balance", "INSUFFICIENT_BALANCE");
  }
}

export class SerializationError extends SeekerIOUError {
  constructor(reason: string) {
    super(`Serialization error: ${reason}`, "SERIALIZATION_ERROR");
  }
}
