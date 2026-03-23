# seeker-iou: Product Requirements Document

## One-liner

On-chain vault and settlement protocol for offline peer-to-peer payments between Solana Seeker devices via NFC-exchanged signed IOUs.

## Repository

github.com/saicharanpogul/seeker-iou

## What This Is

seeker-iou is the infrastructure layer for offline payments on Seeker. It has two parts:

1. A Solana program (Anchor) that manages payment vaults, validates IOUs, settles balances, and enforces anti-cheat rules.
2. A TypeScript SDK that handles IOU creation, serialization, NFC payload formatting, signature verification, and settlement transaction building.

This repo does NOT include a mobile app. The app comes later and consumes this SDK. Right now we're building the rails.

## Why This Can Only Exist on Seeker

Every component depends on hardware that only Seeker has:

- **Seed Vault** signs IOUs at the hardware level. The private key never touches the app layer. Even compromised software produces legitimate signatures.
- **SGT (Seeker Genesis Token)** ties every participant to a unique physical device. One device, one identity. Cheaters can't create new accounts.
- **NFC** enables tap-to-transfer of signed data blobs between two phones without any network connection.
- **.skr domains** give human-readable identities to payment participants so you see "chai-vendor.skr" not a base58 string.

Without all four of these, you're building a generic state channel. With them, you're building an offline payment system that has hardware-backed identity, tamper-proof signing, and a physical transfer mechanism built into the device.

---

## How It Works

### The Bar Tab Mental Model

You walk into a bar. You hand the bartender your credit card. They hold it and open a tab. You order drinks all night. Each drink is a note on the tab, not a card swipe. At the end of the night, one charge settles everything.

Translated to seeker-iou:

- Opening the tab = depositing tokens into an on-chain vault
- Each drink = a signed IOU exchanged over NFC
- Closing the tab = settlement transaction on Solana

### Three Phases

**Phase 1: Vault Deposit (online, once)**

User deposits SPL tokens (SKR, USDC, or any supported mint) into a personal vault managed by the seeker-iou program. The vault locks funds. The user's device stores the vault state locally: deposited amount, current nonce (starts at 0), and the vault PDA address.

This is the only step that requires internet. Done once before going offline. Think of it as loading a prepaid card.

**Phase 2: IOU Exchange (offline, repeatable)**

User A taps their Seeker against User B's Seeker via NFC. User A's Seed Vault signs an IOU message. The signed IOU transfers to User B's phone over NFC.

An IOU is a structured message containing:
- Sender vault PDA
- Sender wallet address
- Recipient wallet address
- Token mint address
- Amount (raw lamports/smallest unit)
- Nonce (sequential, starts at 1, increments per IOU)
- Expiry timestamp (optional, unix timestamp after which the IOU is void)
- SGT mint address of the sender (for reputation tracking)

The sender's Seed Vault signs this message using Ed25519. The signed bytes plus the original message transfer to the recipient over NFC.

No internet required. No RPC call. No transaction submitted. Just a signed data blob moving between two phones.

The sender's device locally decrements their available balance and increments their nonce. The recipient's device stores the received IOU.

**Phase 3: Settlement (online, batched)**

When any participant reconnects to the internet, they submit collected IOUs to the seeker-iou Solana program. The program:

1. Verifies each Ed25519 signature against the sender's wallet address
2. Validates the nonce is sequential and hasn't been used before
3. Checks the vault has sufficient balance
4. Checks the IOU hasn't expired (if expiry was set)
5. Transfers tokens from the sender's vault to the recipient's wallet
6. Records the settlement outcome (success or failure) linked to the sender's SGT mint address
7. Updates the vault's on-chain nonce to prevent replay

Settlement can be batched. Multiple IOUs from different senders can be submitted in a single transaction (up to Solana's transaction size limit).

---

## Solana Program Design

### Framework

Anchor (latest stable). Program name: `seeker_iou`.

### Accounts

#### StakeConfig (Global singleton, not per-user)

Actually, this program has no global config for v1. Each vault is independent.

#### Vault

One per user per token mint. PDA derived from `[b"vault", user_wallet, token_mint]`.

```
Vault {
    owner: Pubkey,            // wallet that created this vault
    token_mint: Pubkey,       // SPL token mint (SKR, USDC, etc.)
    token_account: Pubkey,    // associated token account holding the funds
    deposited_amount: u64,    // total deposited
    spent_amount: u64,        // total settled (sum of all successful IOU settlements)
    current_nonce: u64,       // highest settled nonce (IOUs must be > this)
    sgt_mint: Pubkey,         // SGT mint address of the vault owner (for reputation)
    created_at: i64,          // unix timestamp
    is_active: bool,          // can be deactivated by owner to withdraw remaining funds
    bump: u8,
}
```

Available balance at any time: `deposited_amount - spent_amount`

#### SettlementRecord

One per settled IOU. PDA derived from `[b"settlement", vault_pda, nonce_bytes]`.

```
SettlementRecord {
    vault: Pubkey,            // the vault this IOU was drawn against
    recipient: Pubkey,        // who received the payment
    amount: u64,
    nonce: u64,
    settled_at: i64,          // unix timestamp of settlement
    settled_by: Pubkey,       // who submitted the settlement tx (can be anyone)
    bump: u8,
}
```

This account serves two purposes: prevents replay (nonce already used) and provides on-chain receipt history.

#### ReputationAccount

One per SGT mint address. PDA derived from `[b"reputation", sgt_mint]`.

```
ReputationAccount {
    sgt_mint: Pubkey,         // the SGT tied to this reputation
    total_issued: u64,        // total number of IOUs ever issued by this device
    total_settled: u64,       // total IOUs successfully settled
    total_failed: u64,        // total IOUs that failed settlement (insufficient funds)
    total_volume: u64,        // total token volume successfully settled
    last_failure_at: i64,     // timestamp of most recent failure (0 if none)
    created_at: i64,
    bump: u8,
}
```

Trust score can be derived client-side: `total_settled / (total_settled + total_failed)`. A score of 1.0 means never cheated. Below 0.95 is a warning. Below 0.8 is a red flag.

### Instructions

#### `create_vault`

Creates a new vault for a user + token mint pair. Requires the user to prove SGT ownership (passes SGT token account, program verifies it matches the known SGT mint authority/metadata/group using the same verification logic as seeker-sdk).

Accounts:
- `owner` (signer): wallet creating the vault
- `vault` (init, PDA): the vault account
- `token_mint`: the SPL token mint
- `vault_token_account` (init): ATA for the vault PDA to hold tokens
- `sgt_token_account`: user's token account holding their SGT (verified on-chain)
- `sgt_mint`: the mint address of the user's SGT
- `reputation` (init_if_needed, PDA): reputation account for this SGT
- `system_program`, `token_program`, `associated_token_program`, `rent`

Validation:
- Verify the SGT token account belongs to the owner
- Verify the SGT mint has the correct mint authority (`GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4`), metadata pointer, and group membership (same checks as seeker-sdk's `verifySGT`)
- Vault for this owner + mint must not already exist

#### `deposit`

Adds funds to an existing vault. Standard SPL token transfer from user's ATA to vault's ATA.

Accounts:
- `owner` (signer)
- `vault` (mut, PDA)
- `owner_token_account` (mut): user's ATA
- `vault_token_account` (mut): vault's ATA
- `token_program`

Args:
- `amount: u64`

Validation:
- Vault must be active
- Vault owner must match signer
- Amount must be > 0

Updates: `vault.deposited_amount += amount`

#### `settle_iou`

The core instruction. Anyone can call this (not just the sender or recipient). Permissionless settlement enables third-party relayers and batch settlement.

Accounts:
- `settler` (signer): whoever is submitting the settlement tx (pays gas)
- `vault` (mut, PDA): sender's vault
- `vault_token_account` (mut): vault's ATA
- `recipient` (mut): recipient wallet
- `recipient_token_account` (init_if_needed, mut): recipient's ATA for this token
- `settlement_record` (init, PDA): prevents replay
- `reputation` (mut, PDA): sender's reputation account
- `instructions_sysvar`: Solana Instructions sysvar (for Ed25519 sig verification)
- `system_program`, `token_program`, `associated_token_program`

Args:
- `iou_message: Vec<u8>`: the serialized IOU message
- `signature: [u8; 64]`: Ed25519 signature over the IOU message
- `nonce: u64`: the IOU nonce (also embedded in the message, passed separately for PDA derivation)

Validation:
1. Deserialize `iou_message` and verify all fields match the accounts passed
2. Verify Ed25519 signature using Solana's `Ed25519Program` via the instructions sysvar (the Ed25519 verify instruction must precede this instruction in the same transaction)
3. Verify `nonce > vault.current_nonce` (prevents replay and enforces ordering)
4. Verify settlement record PDA doesn't already exist (double-check against replay)
5. Check `vault.deposited_amount - vault.spent_amount >= amount` (sufficient balance)
6. If expiry is set in the IOU, verify `Clock::get()?.unix_timestamp <= expiry`
7. Verify `iou_message.sgt_mint == vault.sgt_mint` (sender's SGT matches vault)

On success:
- Transfer `amount` from vault ATA to recipient ATA
- `vault.spent_amount += amount`
- `vault.current_nonce = nonce`
- Create settlement record
- `reputation.total_issued += 1` (if first time seeing this nonce)
- `reputation.total_settled += 1`
- `reputation.total_volume += amount`

On insufficient funds:
- Do NOT transfer
- Still create settlement record (marked as failed, add a `success: bool` field)
- `reputation.total_issued += 1`
- `reputation.total_failed += 1`
- `reputation.last_failure_at = Clock::get()?.unix_timestamp`
- Emit an event so the recipient knows it failed

This is critical. Failed IOUs still get recorded. The sender's reputation takes a hit even if the payment doesn't go through. This is the accountability mechanism.

#### `withdraw`

Vault owner withdraws remaining funds. Only works if vault is deactivated.

Accounts:
- `owner` (signer)
- `vault` (mut, PDA)
- `vault_token_account` (mut)
- `owner_token_account` (mut)
- `token_program`

Validation:
- Vault owner must match signer
- Vault must be inactive (`is_active == false`)
- Remaining balance: `deposited_amount - spent_amount` must be > 0

Transfers remaining balance back to owner.

#### `deactivate_vault`

Owner signals they want to close the vault and withdraw. Sets `is_active = false`. After this, no new IOUs against this vault will settle (the settle instruction checks `vault.is_active`).

There should be a cooldown: vault can only be withdrawn from after a delay (e.g., 1 hour) from deactivation. This gives pending IOU holders time to settle before the vault drains.

Accounts:
- `owner` (signer)
- `vault` (mut, PDA)

#### `reactivate_vault`

Owner can reactivate a deactivated vault (if they haven't withdrawn yet). Sets `is_active = true`.

### Ed25519 Signature Verification

Solana doesn't natively verify Ed25519 signatures inside a program. You use the `Ed25519Program` precompile. The pattern:

1. The settlement transaction includes an `Ed25519Program` instruction that contains the public key, message, and signature
2. The `settle_iou` instruction reads the previous instruction from the instructions sysvar and verifies it was a valid Ed25519 verification instruction with the correct parameters

This is the same pattern used by Serum, Wormhole, and other programs that verify off-chain signatures on Solana. It's battle-tested.

### Events

Emit Anchor events for indexing:

```
VaultCreated { owner, token_mint, vault, sgt_mint }
Deposited { vault, amount, new_total }
IOUSettled { vault, recipient, amount, nonce, settler }
IOUFailed { vault, recipient, amount, nonce, settler, reason }
VaultDeactivated { vault, owner }
VaultWithdrawn { vault, owner, amount }
```

---

## IOU Message Format

The IOU is a structured byte array that gets signed by the sender's Seed Vault. Must be deterministic and compact for NFC transfer.

### Serialization

Use Borsh serialization (same as Anchor). The IOU struct:

```rust
#[derive(BorshSerialize, BorshDeserialize)]
pub struct IOUMessage {
    pub version: u8,              // protocol version (1 for v1)
    pub vault: Pubkey,            // sender's vault PDA
    pub sender: Pubkey,           // sender's wallet
    pub recipient: Pubkey,        // recipient's wallet
    pub token_mint: Pubkey,       // which token
    pub amount: u64,              // raw amount (smallest unit)
    pub nonce: u64,               // sequential, starts at 1
    pub expiry: i64,              // unix timestamp, 0 = no expiry
    pub sgt_mint: Pubkey,         // sender's SGT for reputation
    pub memo: [u8; 32],           // optional 32-byte memo (UTF-8, zero-padded)
}
```

Total size: 1 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 32 + 32 = **217 bytes**

With a 64-byte Ed25519 signature appended: **281 bytes** total NFC payload.

NFC can handle this easily. Android's NFC (NDEF) supports payloads up to several KB.

### Version Field

Version 1 for initial release. The version byte allows future protocol upgrades without breaking existing IOUs. Settlement program checks version and routes to the correct validation logic.

### Memo Field

32 bytes for an optional human-readable note. "mangoes", "chai x2", "rent march". Zero-padded if shorter. Stored in settlement record for receipt history.

---

## TypeScript SDK (`seeker-iou` npm package)

### Structure

```
seeker-iou/
├── src/
│   ├── index.ts              // public exports
│   ├── iou.ts                // IOU creation, serialization, signing helpers
│   ├── vault.ts              // vault creation, deposit, withdraw instruction builders
│   ├── settlement.ts         // settlement instruction builders, batch settlement
│   ├── reputation.ts         // reputation account queries
│   ├── nfc.ts                // NFC payload encoding/decoding (NDEF format)
│   ├── verification.ts       // client-side IOU signature verification
│   ├── types.ts              // all TypeScript interfaces
│   ├── constants.ts          // program ID, PDAs, known addresses
│   ├── errors.ts             // custom error classes
│   └── utils.ts              // helpers (PDA derivation, amount formatting)
├── tests/
│   ├── iou.test.ts
│   ├── vault.test.ts
│   ├── settlement.test.ts
│   ├── reputation.test.ts
│   ├── nfc.test.ts
│   └── verification.test.ts
├── idl/
│   └── seeker_iou.json       // Anchor IDL (generated after program build)
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

### Core SDK Functions

#### IOU Creation and Serialization

```typescript
interface IOUParams {
  vault: PublicKey;
  sender: PublicKey;
  recipient: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;               // raw amount in smallest unit
  nonce: number;
  sgtMint: PublicKey;
  expiry?: number;              // unix timestamp, defaults to 0 (no expiry)
  memo?: string;                // max 32 bytes UTF-8
}

// Create the IOU message bytes (Borsh serialized)
function createIOUMessage(params: IOUParams): Uint8Array;

// Deserialize IOU message bytes back to structured data
function parseIOUMessage(data: Uint8Array): IOUParams;

// Verify an IOU signature client-side (before settlement)
function verifyIOUSignature(
  message: Uint8Array,
  signature: Uint8Array,
  senderPublicKey: PublicKey
): boolean;
```

#### NFC Payload Encoding

```typescript
interface NFCPayload {
  message: Uint8Array;          // serialized IOU message
  signature: Uint8Array;        // 64-byte Ed25519 signature
}

// Encode IOU + signature into an NDEF-compatible payload
function encodeNFCPayload(payload: NFCPayload): Uint8Array;

// Decode received NFC bytes back to IOU + signature
function decodeNFCPayload(data: Uint8Array): NFCPayload;

// Validate a received NFC payload (check structure, version, deserialize)
function validateNFCPayload(data: Uint8Array): {
  valid: boolean;
  iou: IOUParams | null;
  signature: Uint8Array | null;
  error: string | null;
};
```

#### Vault Instruction Builders

```typescript
// Create a new vault (requires SGT verification)
function createVaultInstruction(params: {
  owner: PublicKey;
  tokenMint: PublicKey;
  sgtMint: PublicKey;
  sgtTokenAccount: PublicKey;
}): TransactionInstruction;

// Deposit tokens into vault
function createDepositInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;
}): TransactionInstruction;

// Deactivate vault (starts cooldown)
function createDeactivateVaultInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
}): TransactionInstruction;

// Reactivate vault
function createReactivateVaultInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
}): TransactionInstruction;

// Withdraw remaining funds (after cooldown)
function createWithdrawInstruction(params: {
  owner: PublicKey;
  vault: PublicKey;
  tokenMint: PublicKey;
}): TransactionInstruction;
```

#### Settlement Instruction Builders

```typescript
// Settle a single IOU
function createSettleIOUInstruction(params: {
  settler: PublicKey;           // who pays gas
  vault: PublicKey;
  recipient: PublicKey;
  tokenMint: PublicKey;
  iouMessage: Uint8Array;
  signature: Uint8Array;
  nonce: number;
  sgtMint: PublicKey;
}): TransactionInstruction[];
// Returns TWO instructions: Ed25519 verify + settle_iou

// Settle multiple IOUs in one transaction
function createBatchSettleInstructions(params: {
  settler: PublicKey;
  ious: Array<{
    vault: PublicKey;
    recipient: PublicKey;
    tokenMint: PublicKey;
    iouMessage: Uint8Array;
    signature: Uint8Array;
    nonce: number;
    sgtMint: PublicKey;
  }>;
}): TransactionInstruction[];
// Returns pairs of [Ed25519 verify, settle_iou] for each IOU
// Caller must check total size fits in one Solana transaction
```

#### Vault and Reputation Queries

```typescript
// Fetch vault state
function getVault(
  connection: Connection,
  owner: PublicKey,
  tokenMint: PublicKey
): Promise<VaultAccount | null>;

// Get available balance (deposited - spent)
function getAvailableBalance(
  connection: Connection,
  owner: PublicKey,
  tokenMint: PublicKey
): Promise<bigint>;

// Fetch reputation for an SGT
function getReputation(
  connection: Connection,
  sgtMint: PublicKey
): Promise<ReputationAccount | null>;

// Calculate trust score from reputation
function calculateTrustScore(reputation: ReputationAccount): number;
// Returns 0.0 to 1.0

// Get settlement history for a vault
function getSettlementHistory(
  connection: Connection,
  vault: PublicKey
): Promise<SettlementRecord[]>;
```

#### PDA Derivation

```typescript
function deriveVaultPda(owner: PublicKey, tokenMint: PublicKey): [PublicKey, number];
function deriveSettlementRecordPda(vault: PublicKey, nonce: number): [PublicKey, number];
function deriveReputationPda(sgtMint: PublicKey): [PublicKey, number];
```

#### Local State Management

The SDK needs helpers for managing offline state on the device:

```typescript
interface LocalVaultState {
  vaultAddress: string;
  tokenMint: string;
  depositedAmount: bigint;
  spentAmount: bigint;         // sum of all IOUs issued (locally tracked)
  currentNonce: number;        // last used nonce
  pendingIOUs: PendingIOU[];   // IOUs issued but not yet settled
}

interface PendingIOU {
  recipient: string;
  amount: bigint;
  nonce: number;
  message: Uint8Array;
  signature: Uint8Array;
  createdAt: number;
  settled: boolean;
}

interface ReceivedIOU {
  sender: string;
  senderSgtMint: string;
  amount: bigint;
  nonce: number;
  message: Uint8Array;
  signature: Uint8Array;
  receivedAt: number;
  settled: boolean;
  settlementTx: string | null;
}

// Track a newly issued IOU (called after signing and NFC transfer)
function trackIssuedIOU(state: LocalVaultState, iou: PendingIOU): LocalVaultState;

// Get remaining issuable balance
function getLocalAvailableBalance(state: LocalVaultState): bigint;

// Serialize local state for device storage
function serializeLocalState(state: LocalVaultState): Uint8Array;

// Deserialize local state from device storage
function deserializeLocalState(data: Uint8Array): LocalVaultState;
```

These are pure functions. The mobile app decides where to persist them (AsyncStorage, SQLite, etc). The SDK just handles serialization.

---

## Anti-Cheat Mechanisms

### 1. Vault Balance Visibility

When receiving an IOU via NFC, the recipient's device gets the sender's vault PDA address as part of the IOU message. The recipient's app caches vault states from the last time it was online. On receive, it shows:

- Vault deposited amount (from cache)
- Amount of this IOU
- How much of the vault this IOU represents
- Warning if IOU amount > cached available balance

This is best-effort. The cache could be stale. But it catches obvious fraud (50 SKR vault, 500 SKR IOU).

### 2. SGT-Linked Reputation

Every vault is tied to an SGT mint address. Every settlement (success or failure) updates the reputation account for that SGT. Since SGTs are one per device and non-transferable (except within the same Seed Vault), reputation is permanent.

The SDK provides `calculateTrustScore()` which the app displays on receive:

- 1.0 = perfect record, never had a failed settlement
- 0.95-0.99 = minor issues, generally trustworthy
- 0.8-0.95 = multiple failures, proceed with caution
- Below 0.8 = frequent failures, high risk

Reputation is cached on device and synced when online.

### 3. Nonce Ordering

IOUs have sequential nonces. The on-chain program only accepts nonces strictly greater than the vault's current settled nonce. This means:

- Alice can't replay the same IOU twice (nonce already used)
- Alice can't issue two IOU #1s to different people (first to settle wins, second gets rejected)
- IOUs must settle in order (nonce 3 can't settle before nonce 2)

The nonce ordering also means if Alice issues 10 IOUs but only has enough balance for 7, IOUs 8-10 will fail. The recipients of IOUs 8-10 see a reputation hit on Alice's SGT.

### 4. Overcollateralization (v2)

Not in v1, but designed for: vault owner can set a "reserve ratio" where only X% of deposited funds are available for IOUs. The remaining percentage acts as a bond. On failed settlements, the bond gets slashed to partially compensate the cheated recipient.

The vault account has space reserved for these fields (added later via program upgrade):

```
reserved_amount: u64,         // set aside as bond (v2)
reserve_ratio_bps: u16,       // basis points, e.g. 3000 = 30% reserve (v2)
```

### 5. Configurable Risk Tiers (app-level, not protocol-level)

The SDK exposes reputation data. The app decides thresholds:

```typescript
interface RiskConfig {
  autoAcceptBelow: bigint;     // auto-accept IOUs under this amount
  warnAbove: bigint;           // show warning above this amount
  requireOnlineAbove: bigint;  // refuse offline IOUs above this amount
  minTrustScore: number;       // reject senders below this score
}
```

This is NOT enforced on-chain. It's app-level UX. Different merchants can have different risk tolerances.

### 6. Deactivation Cooldown

When a vault owner deactivates their vault (to withdraw funds), there's a cooldown period. During cooldown, pending IOUs can still settle. This prevents the attack where Alice issues IOUs, immediately deactivates, withdraws, and leaves recipients with worthless IOUs.

Cooldown duration: 3600 seconds (1 hour) for v1. Configurable per vault in v2.

```
deactivated_at: i64,          // 0 if active, timestamp if deactivated
cooldown_seconds: u32,        // default 3600
```

Withdraw instruction checks: `Clock::get()?.unix_timestamp >= vault.deactivated_at + vault.cooldown_seconds`

---

## Supported Tokens

v1 supports any SPL token. The vault is parameterized by token mint. A user can have multiple vaults for different tokens:

- SKR vault for ecosystem payments
- USDC vault for stable-value transactions
- SOL vault (wrapped SOL) for general use

The IOU message includes the token mint so there's no ambiguity about which token is being transferred.

---

## Transaction Size Considerations

A single `settle_iou` requires two instructions: Ed25519 verify + the actual settle instruction. Each pair is roughly ~500 bytes. A Solana transaction has a 1232 byte limit.

Realistically, you can fit 2 IOU settlements per transaction. For batch settlement of many IOUs, the SDK should automatically chunk them into multiple transactions.

The SDK's `createBatchSettleInstructions` returns all instruction pairs, and a helper `chunkSettlementTransactions` splits them into transaction-sized batches:

```typescript
function chunkSettlementTransactions(
  instructions: TransactionInstruction[],
  feePayer: PublicKey
): Transaction[];
```

---

## Development Roadmap

### Phase 1: Solana Program (Week 1-2)

1. Set up Anchor project with program scaffold
2. Implement Vault account and `create_vault` instruction with SGT verification
3. Implement `deposit` instruction
4. Implement IOU message Borsh serialization/deserialization in program
5. Implement `settle_iou` with Ed25519 verification via instructions sysvar
6. Implement ReputationAccount and update logic
7. Implement `deactivate_vault`, `reactivate_vault`, `withdraw` with cooldown
8. Implement SettlementRecord for replay prevention
9. Write comprehensive Anchor tests (happy path + every attack vector)
10. Deploy to devnet

### Phase 2: TypeScript SDK (Week 2-3)

1. Set up TypeScript project (tsup, vitest, dual ESM/CJS)
2. Generate and import Anchor IDL
3. Implement IOU message creation and serialization (matching program's Borsh format)
4. Implement NFC payload encoding/decoding (NDEF wrapper)
5. Implement all vault instruction builders
6. Implement settlement instruction builders (single + batch)
7. Implement reputation queries and trust score calculation
8. Implement local state management helpers
9. Implement PDA derivation functions
10. Write tests with mocked connections
11. Publish to npm as `seeker-iou`

### Phase 3: Testing and Hardening (Week 3-4)

1. Integration tests on devnet (create vault, deposit, settle IOU end-to-end)
2. Attack vector testing:
   - Double-spend: same nonce to two recipients
   - Replay: submit same IOU twice
   - Overdraw: IOUs exceeding vault balance
   - Deactivation race: deactivate and withdraw before IOUs settle
   - Signature forgery: modified message with original signature
   - Expired IOU submission
   - Wrong token mint in IOU vs vault
3. Gas cost benchmarking per instruction
4. Transaction size testing for batch settlement limits
5. Security review (self-audit, then seek community review)

---

## Build Configuration

### Solana Program

```
anchor-version: 0.30+
solana-version: 1.18+
rust-version: 1.75+
```

Program directory: `programs/seeker-iou/`
Tests directory: `tests/`
IDL output: `target/idl/seeker_iou.json`

### TypeScript SDK

```json
{
  "dependencies": {
    "@solana/web3.js": "^1.95.0",
    "@solana/spl-token": "^0.4.0",
    "@coral-xyz/anchor": "^0.30.0",
    "borsh": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0"
  }
}
```

SDK directory: `sdk/`
Dual output: ESM + CJS via tsup
TypeScript strict mode

---

## Repo Structure

```
seeker-iou/
├── programs/
│   └── seeker-iou/
│       └── src/
│           ├── lib.rs                 // program entrypoint
│           ├── instructions/
│           │   ├── mod.rs
│           │   ├── create_vault.rs
│           │   ├── deposit.rs
│           │   ├── settle_iou.rs
│           │   ├── deactivate_vault.rs
│           │   ├── reactivate_vault.rs
│           │   └── withdraw.rs
│           ├── state/
│           │   ├── mod.rs
│           │   ├── vault.rs
│           │   ├── settlement_record.rs
│           │   └── reputation.rs
│           ├── iou/
│           │   ├── mod.rs
│           │   └── message.rs         // IOU message struct + Borsh
│           ├── errors.rs
│           └── events.rs
├── sdk/
│   ├── src/
│   │   ├── index.ts
│   │   ├── iou.ts
│   │   ├── vault.ts
│   │   ├── settlement.ts
│   │   ├── reputation.ts
│   │   ├── nfc.ts
│   │   ├── verification.ts
│   │   ├── local-state.ts
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   ├── errors.ts
│   │   └── utils.ts
│   ├── tests/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsup.config.ts
│   └── vitest.config.ts
├── tests/                             // Anchor integration tests
│   └── seeker-iou.ts
├── app/                               // placeholder for future mobile app
│   └── README.md
├── Anchor.toml
├── Cargo.toml
├── package.json                       // workspace root
├── README.md
└── LICENSE                            // MIT
```

---

## What NOT to Build in v1

- Mobile app (comes later, separate repo or `/app` directory)
- Overcollateralization / bond slashing (v2)
- Multi-hop IOUs (Alice pays Bob, Bob pays Charlie with Alice's credit). Too complex for v1.
- Cross-token swaps in IOUs (IOU in SKR, settle in USDC). v1 is single-token per vault.
- Governance or protocol fees. Keep it free and open for adoption.
- Relayer network. Anyone can settle. No need for dedicated relayers in v1.
- Merchant discovery or directory. App-level concern.
- Fiat on/off ramp integration. Out of scope.

---

## Security Considerations

- Ed25519 signature verification is done via Solana's native precompile. Do not implement custom signature verification.
- All PDA seeds must be deterministic and collision-resistant. Use explicit prefixes ("vault", "settlement", "reputation").
- The program should be upgradeable in v1 (Anchor default) for bug fixes. Plan to make it immutable after security audit.
- Nonce must be checked strictly (>) not (>=) to prevent off-by-one replay.
- Clock-based expiry uses Solana's on-chain clock which can drift a few seconds. Expiry windows should be in hours, not seconds.
- The vault token account must be owned by the vault PDA, not the user. This prevents the user from draining the token account directly.
- Settlement records are permanent (not closeable) to maintain audit trail. This means rent cost per IOU. At current Solana rent (~0.002 SOL per account), this is negligible but should be documented.

---

## README.md Requirements

The repo README should cover:
1. What seeker-iou is (one paragraph + the bar tab analogy)
2. How it works (three phases with diagrams or descriptions)
3. Architecture overview (program accounts, instruction flow)
4. Quick start for the SDK
5. Anti-cheat mechanisms explained plainly
6. Development setup (Anchor build, SDK build, test)
7. Deployment guide (devnet, then mainnet)
8. Contributing guidelines
9. Security disclosure policy
10. License: MIT
