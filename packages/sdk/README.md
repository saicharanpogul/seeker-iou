# seeker-iou SDK

TypeScript SDK for the seeker-iou on-chain vault and settlement protocol.

## Installation

```bash
bun add seeker-iou
```

## API Reference

### Seeker Device Verification (via seeker-sdk)

```typescript
import {
  verifySeekerForVault,
  isSeeker,
  resolveRecipientDisplay,
  resolveSkrDomain,
  reverseResolveSkr,
} from "seeker-iou";

// Verify SGT ownership before vault creation (returns SGT mint PublicKey)
const sgtMint = await verifySeekerForVault(connection, walletAddress);

// Simple boolean check
if (await isSeeker(connection, walletAddress)) { /* ... */ }

// Resolve recipient to human-readable .skr domain
const display = await resolveRecipientDisplay(connection, recipientAddress);
// "chai-vendor.skr" or null

// Forward/reverse .skr domain resolution
const owner = await resolveSkrDomain(connection, "chai-vendor.skr");
const domain = await reverseResolveSkr(connection, walletAddress);
```

### IOU Creation

```typescript
import { createIOUMessage, parseIOUMessage } from "seeker-iou";

// Serialize an IOU message (217 bytes, Borsh format)
const message = createIOUMessage({
  vault,           // PublicKey - sender's vault PDA
  sender,          // PublicKey - sender's wallet
  recipient,       // PublicKey - recipient's wallet
  tokenMint,       // PublicKey - SPL token mint
  amount: 1000n,   // bigint - raw amount in smallest unit
  nonce: 1,        // number - sequential, starts at 1
  sgtMint,         // PublicKey - sender's SGT mint
  expiry: 0,       // optional unix timestamp (0 = no expiry)
  memo: "coffee",  // optional string (max 32 bytes UTF-8)
});

// Deserialize back
const iou = parseIOUMessage(message);
```

### NFC Encoding

```typescript
import { encodeNFCPayload, decodeNFCPayload, validateNFCPayload } from "seeker-iou";

// Encode for NFC transfer (NDEF format)
const nfcBytes = encodeNFCPayload({ message, signature });

// Decode received NFC data
const { message, signature } = decodeNFCPayload(nfcBytes);

// Validate with full error reporting
const result = validateNFCPayload(nfcBytes);
// { valid: boolean, iou: IOUParams | null, signature: Uint8Array | null, error: string | null }
```

### Signature Verification

```typescript
import { verifySignature } from "seeker-iou";

const isValid = verifySignature(message, signature, senderPublicKey);
```

### Vault Instructions

```typescript
import {
  createVaultInstruction,
  createDepositInstruction,
  createDeactivateVaultInstruction,
  createReactivateVaultInstruction,
  createWithdrawInstruction,
} from "seeker-iou";

const ix = await createVaultInstruction({ owner, tokenMint, sgtMint, sgtTokenAccount });
const depositIx = await createDepositInstruction({ owner, vault, tokenMint, amount: 1000000n });
const deactivateIx = await createDeactivateVaultInstruction({ owner, vault });
const reactivateIx = await createReactivateVaultInstruction({ owner, vault });
const withdrawIx = await createWithdrawInstruction({ owner, vault, tokenMint });
```

### Settlement Instructions

```typescript
import {
  createSettleIOUInstruction,
  createBatchSettleInstructions,
  chunkSettlementTransactions,
} from "seeker-iou";

// Single IOU - returns [Ed25519Ix, SettleIx]
const [ed25519Ix, settleIx] = await createSettleIOUInstruction({
  settler, vault, recipient, tokenMint,
  iouMessage, signature, nonce, sgtMint, senderPublicKey,
});

// Batch - returns all instruction pairs
const allIxs = await createBatchSettleInstructions({ settler, ious: [...] });

// Split into transaction-sized batches (~2 IOUs per tx)
const txs = chunkSettlementTransactions(allIxs, feePayer);
```

### Reputation

```typescript
import { getReputation, calculateTrustScore, getSettlementHistory } from "seeker-iou";

const rep = await getReputation(connection, sgtMint);
const score = calculateTrustScore(rep); // 0.0 to 1.0
const history = await getSettlementHistory(connection, vault);
```

### Local State Management

```typescript
import {
  trackIssuedIOU,
  getLocalAvailableBalance,
  serializeLocalState,
  deserializeLocalState,
} from "seeker-iou";

let state = { vaultAddress, tokenMint, depositedAmount: 1000n, spentAmount: 0n, currentNonce: 0, pendingIOUs: [] };

state = trackIssuedIOU(state, { recipient, amount: 100n, nonce: 1, message, signature, createdAt: Date.now(), settled: false });

const available = getLocalAvailableBalance(state); // 900n

// Persist to device storage
const bytes = serializeLocalState(state);
const restored = deserializeLocalState(bytes);
```

### PDA Derivation

```typescript
import { deriveVaultPda, deriveSettlementRecordPda, deriveReputationPda } from "seeker-iou";

const [vaultPda, bump] = deriveVaultPda(owner, tokenMint);
const [recordPda] = deriveSettlementRecordPda(vault, nonce);
const [repPda] = deriveReputationPda(sgtMint);
```

## License

MIT
