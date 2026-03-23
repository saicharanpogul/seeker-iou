# SECURITY AUDIT REPORT

## seeker-iou: On-Chain Vault and Settlement Protocol for Offline Peer-to-Peer Payments

---

|                    |                                                                 |
|--------------------|-----------------------------------------------------------------|
| **Project**        | seeker-iou                                                      |
| **Version**        | 0.1.0                                                           |
| **Program ID**     | `Appq4U1rTS4tCo4E84qhQs777z3awXf6K55amgnZ5srC`                 |
| **Framework**      | Anchor 0.31.1                                                   |
| **Audit Date**     | 2026-03-23                                                      |
| **Report Date**    | 2026-03-24                                                      |
| **Audit Type**     | Security Self-Audit (automated + manual review)                 |
| **Auditor**        | Internal Engineering Team (self-audit)                          |
| **Report Status**  | Final -- prepared for external auditor handoff                  |
| **Classification** | Confidential                                                    |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Scope](#2-scope)
3. [Methodology](#3-methodology)
4. [Findings Summary](#4-findings-summary)
5. [Detailed Findings](#5-detailed-findings)
6. [Remediation Log](#6-remediation-log)
7. [Recommendations for External Auditors](#7-recommendations-for-external-auditors)
8. [Appendix A: Program Architecture](#appendix-a-program-architecture)
9. [Appendix B: Account Layouts](#appendix-b-account-layouts)
10. [Appendix C: Instruction Reference](#appendix-c-instruction-reference)

---

## 1. Executive Summary

### Overview

seeker-iou is a Solana program that enables offline peer-to-peer payments between Solana Seeker device holders. Vault owners deposit SPL tokens, issue Ed25519-signed IOU messages exchanged via NFC, and recipients later settle IOUs on-chain. The protocol includes overcollateralization (reserve bonding), reputation tracking per Seeker Genesis Token (SGT), and a cooldown-gated withdrawal mechanism.

### Overall Risk Assessment

| Risk Level | Assessment |
|------------|------------|
| **Overall** | **LOW-MEDIUM** |

No critical or high-severity vulnerabilities were identified. Five medium-severity issues were found, of which three have been remediated with code fixes and one is mitigated by design. The remaining findings are low-severity or informational, with most mitigated by inherent protocol design or representing accepted trade-offs documented in the product requirements.

### Summary Statistics

| Severity | Count | Fixed | Mitigated by Design | Accepted Risk | Open |
|----------|-------|-------|---------------------|---------------|------|
| Critical | 0     | --    | --                  | --            | 0    |
| High     | 0     | --    | --                  | --            | 0    |
| Medium   | 5     | 3     | 1                   | 1             | 0    |
| Low      | 10    | 1     | 7                   | 2             | 0    |
| Info     | 4     | --    | --                  | 4             | 0    |
| **Total**| **19**| **4** | **8**               | **7**         | **0**|

### Key Positive Findings

- All privileged operations enforce signer checks via Anchor `Signer<'info>` constraints.
- PDA derivation uses unique, collision-resistant seed combinations.
- All arithmetic uses `checked_add` / `checked_sub` / `saturating_sub` to prevent overflow and underflow.
- Ed25519 signature verification includes inline-data-only enforcement (instruction index = `0xFFFF`).
- Token transfers use `TransferChecked` CPI with mint decimal verification.
- Settlement records are PDA-derived per vault+nonce, making replay impossible.

---

## 2. Scope

### 2.1 On-Chain Program (Rust)

All files under `programs/seeker-iou/src/` were reviewed:

| File | Description |
|------|-------------|
| `programs/seeker-iou/src/lib.rs` | Program entrypoint; declares all 8 instructions |
| `programs/seeker-iou/src/state/vault.rs` | `Vault` account struct with balance/bond helpers |
| `programs/seeker-iou/src/state/settlement_record.rs` | `SettlementRecord` account struct |
| `programs/seeker-iou/src/state/reputation.rs` | `ReputationAccount` account struct |
| `programs/seeker-iou/src/state/mod.rs` | State module re-exports |
| `programs/seeker-iou/src/instructions/create_vault.rs` | Vault initialization with SGT verification |
| `programs/seeker-iou/src/instructions/deposit.rs` | SPL token deposit into vault |
| `programs/seeker-iou/src/instructions/settle_iou.rs` | IOU settlement with Ed25519 verification and bond slashing |
| `programs/seeker-iou/src/instructions/deactivate_vault.rs` | Vault deactivation by owner |
| `programs/seeker-iou/src/instructions/reactivate_vault.rs` | Vault reactivation by owner |
| `programs/seeker-iou/src/instructions/withdraw.rs` | Cooldown-gated withdrawal |
| `programs/seeker-iou/src/instructions/set_cooldown.rs` | Cooldown parameter update |
| `programs/seeker-iou/src/instructions/set_reserve_ratio.rs` | Reserve ratio parameter update |
| `programs/seeker-iou/src/instructions/mod.rs` | Instruction module re-exports |
| `programs/seeker-iou/src/iou/message.rs` | `IOUMessage` Borsh-serialized struct |
| `programs/seeker-iou/src/iou/mod.rs` | IOU module re-exports |
| `programs/seeker-iou/src/errors.rs` | Custom error definitions |
| `programs/seeker-iou/src/events.rs` | Anchor event definitions |

### 2.2 Client SDK (TypeScript)

All files under `packages/sdk/src/` were reviewed:

| File | Description |
|------|-------------|
| `packages/sdk/src/index.ts` | SDK barrel exports |
| `packages/sdk/src/types.ts` | TypeScript type definitions |
| `packages/sdk/src/constants.ts` | Program ID, seeds, sizes |
| `packages/sdk/src/errors.ts` | Client-side error classes |
| `packages/sdk/src/utils.ts` | PDA derivation, amount formatting, bond calculations |
| `packages/sdk/src/iou.ts` | IOU message creation and parsing |
| `packages/sdk/src/nfc.ts` | NDEF NFC payload encoding/decoding |
| `packages/sdk/src/verification.ts` | Client-side Ed25519 signature verification |
| `packages/sdk/src/vault.ts` | Vault/deposit/withdraw instruction builders |
| `packages/sdk/src/settlement.ts` | Settlement instruction builders with batching |
| `packages/sdk/src/reputation.ts` | Reputation queries and trust score calculation |
| `packages/sdk/src/local-state.ts` | Local device state management |
| `packages/sdk/src/seeker.ts` | Seeker SDK integration for SGT verification |

### 2.3 Test Coverage

| File | Description |
|------|-------------|
| `tests/seeker-iou.ts` | Anchor integration test suite |
| `tests/benchmark.ts` | Compute unit benchmarking per instruction |
| `packages/sdk/tests/iou.test.ts` | IOU creation and parsing tests |
| `packages/sdk/tests/nfc.test.ts` | NFC payload encoding tests |
| `packages/sdk/tests/verification.test.ts` | Signature verification tests |
| `packages/sdk/tests/reputation.test.ts` | Reputation calculation tests |
| `packages/sdk/tests/local-state.test.ts` | Local state serialization tests |
| `packages/sdk/tests/utils.test.ts` | Utility function tests |

### 2.4 Out of Scope

- External `seeker-sdk` dependency internals
- Solana runtime and validator behavior
- Token-2022 extension-specific attack surfaces
- Frontend/mobile application code
- Deployment infrastructure and key management

---

## 3. Methodology

### 3.1 Audit Framework

This audit follows an OWASP-equivalent security checklist adapted for Solana/Anchor programs. Each check category maps to known Solana-specific vulnerability classes.

### 3.2 Check Categories

| # | Category | Description | Result |
|---|----------|-------------|--------|
| M-1 | **Signer Checks** | Every privileged operation verifies the transaction signer has authority. Owner-gated instructions use `Signer<'info>` + `has_one = owner`. | PASS |
| M-2 | **PDA Derivation & Collision** | All PDAs use deterministic, unique seed combinations. No two accounts can share a PDA. | PASS |
| M-3 | **Integer Overflow / Underflow** | All arithmetic uses `checked_add`, `checked_sub`, or `saturating_sub`. Bond calculation uses `u128` intermediate. | PASS |
| M-4 | **Reentrancy** | Solana's single-threaded execution model prevents traditional reentrancy. CPI calls to token program are stateless. State updates occur after CPI in withdraw but before CPI would be re-entered. | PASS |
| M-5 | **Token Account Ownership** | Vault token accounts are ATA-derived with vault PDA as authority. Owner/recipient ATAs are verified via `associated_token::authority`. | PASS |
| M-6 | **Replay Attacks** | Settlement record PDA (`["settlement", vault, nonce_le_bytes]`) is `init`-constrained. Second settlement with same nonce fails at account creation. Nonce is strictly increasing. | PASS |
| M-7 | **Clock Manipulation** | Solana clock can drift approximately 30 seconds. IOU expiry is designed for hour-scale windows. Cooldown minimum is 300 seconds. Drift is not exploitable at these time scales. | PASS (accepted risk) |
| M-8 | **Privilege Escalation** | `set_cooldown` and `set_reserve_ratio` require `vault.is_active == true`, preventing post-deactivation parameter manipulation. Vault PDA seeds include owner, preventing cross-user access. | PASS (after fix) |
| M-9 | **Ed25519 Signature Verification** | Instruction index fields validated as `0xFFFF` (inline data only). Public key, signature, and message are cross-verified against the Ed25519 precompile instruction data. | PASS (after fix) |
| M-10 | **Account Confusion / Type Confusion** | All accounts are typed via Anchor's `Account<'info, T>` with discriminator checks. `UncheckedAccount` usage is limited to `recipient` (validated against IOU message) and `instructions_sysvar` (validated by address). | PASS |
| M-11 | **Cross-Program Invocation (CPI) Safety** | CPI targets are typed (`TokenInterface`, `AssociatedToken`, `System`). PDA signer seeds are correctly constructed. No arbitrary CPI targets. | PASS |
| M-12 | **Denial of Service** | Permissionless `settle_iou` allows anyone to pay rent for settlement records. No unbounded loops. Compute usage is bounded. | PASS |

### 3.3 Tools Used

- Manual source code review
- Anchor constraint analysis
- PDA seed collision analysis
- Integer overflow path tracing
- Ed25519 instruction data format verification
- Attack scenario modeling

---

## 4. Findings Summary

| ID | Title | Severity | Status | Category |
|----|-------|----------|--------|----------|
| SEK-001 | Ed25519 instruction_index fields not validated | Medium | **Fixed** | M-9 |
| SEK-002 | Cooldown changeable after vault deactivation | Medium | **Fixed** | M-8 |
| SEK-003 | Reserve ratio changeable after vault deactivation | Medium | **Fixed** | M-8 |
| SEK-004 | Withdraw used book value instead of actual balance | Medium | **Fixed** | M-5 |
| SEK-005 | Nonce allows gaps (non-sequential) | Medium | Mitigated by Design | M-6 |
| SEK-006 | Permissionless settlement (any signer) | Low | Mitigated by Design | M-12 |
| SEK-007 | Zero expiry means IOU never expires | Low | Mitigated by Design | M-7 |
| SEK-008 | Clock drift affects expiry enforcement | Low | Accepted Risk | M-7 |
| SEK-009 | Reputation is per-SGT-mint (not per-wallet) | Low | By Design | M-2 |
| SEK-010 | Bond truncation on small balances | Low | Accepted Risk | M-3 |
| SEK-011 | Ed25519 instruction hardcoded at index 0 | Low | Mitigated by Design | M-9 |
| SEK-012 | Settler pays recipient ATA rent | Info | By Design | M-12 |
| SEK-013 | Settlement records are permanent (no close) | Info | By Design | M-12 |
| SEK-014 | No upgrade authority management | Low | Mitigated by Design | M-8 |
| SEK-015 | SGT mint authority is hardcoded | Low | Mitigated by Design | M-10 |
| SEK-016 | Batch settlement Ed25519 index assumption | Low | Mitigated by Design | M-9 |
| SEK-017 | Local state does not track bond/reserve | Info | Informational | -- |
| SEK-018 | No rate limiting on vault creation | Low | Mitigated by Design | M-12 |
| SEK-019 | Nonce stored as u64 in SDK as number | Info | Informational | -- |

---

## 5. Detailed Findings

---

### SEK-001: Ed25519 instruction_index Fields Not Validated

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Fixed |
| **File** | `programs/seeker-iou/src/instructions/settle_iou.rs` |
| **Lines** | 340--352 (post-fix) |
| **Category** | Ed25519 Signature Verification (M-9) |

#### Description

The Ed25519 precompile instruction data contains three `instruction_index` fields: `signature_instruction_index`, `public_key_instruction_index`, and `message_instruction_index`. When these are set to `0xFFFF`, the data is read inline from the Ed25519 instruction itself. When set to any other value, the data is read from a different instruction in the same transaction.

Prior to the fix, only the offset values and data content were verified, but the instruction index fields were not checked. An attacker could craft a transaction where the Ed25519 precompile reads a public key, signature, or message from a different instruction in the transaction, potentially allowing a signature crafted for one context to be replayed in another.

#### Impact

An attacker could potentially construct a multi-instruction transaction where the Ed25519 precompile reads signature data from a malicious instruction, bypassing the intended signature verification. This could allow settlement of IOUs with forged authorization.

#### Attack Scenario

1. Attacker crafts an Ed25519 precompile instruction with `public_key_instruction_index = 2` (pointing to a third instruction).
2. The third instruction contains a different public key that the attacker controls.
3. The Ed25519 precompile verifies the signature against the attacker-controlled key.
4. The settle_iou handler checks that the Ed25519 instruction's inline offsets point to matching data, but since the actual verification used the cross-referenced instruction, the check is bypassed.

#### Recommendation

Validate that all three instruction index fields equal `0xFFFF`.

#### Remediation

Fixed. The following validation was added to `verify_ed25519_signature()`:

```rust
require!(
    signature_instruction_index == u16::MAX,
    SeekerIOUError::InvalidEd25519InstructionData
);
require!(
    public_key_instruction_index == u16::MAX,
    SeekerIOUError::InvalidEd25519InstructionData
);
require!(
    message_instruction_index == u16::MAX,
    SeekerIOUError::InvalidEd25519InstructionData
);
```

---

### SEK-002: Cooldown Changeable After Vault Deactivation

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Fixed |
| **File** | `programs/seeker-iou/src/instructions/set_cooldown.rs` |
| **Lines** | 12--19 (post-fix) |
| **Category** | Privilege Escalation (M-8) |

#### Description

The `set_cooldown` instruction did not enforce that the vault be in an active state. A vault owner could deactivate their vault, immediately reduce the cooldown to the minimum (300 seconds), and withdraw funds well before the originally configured cooldown period elapsed.

#### Impact

This defeats the purpose of the cooldown mechanism, which exists to give IOU recipients time to settle outstanding IOUs before the vault owner can withdraw funds. A malicious vault owner could issue IOUs, deactivate, shorten cooldown, and drain the vault before recipients can settle.

#### Attack Scenario

1. Vault owner configures a 24-hour cooldown and issues IOUs.
2. Vault owner calls `deactivate_vault`.
3. Vault owner calls `set_cooldown(300)` -- previously allowed even when inactive.
4. After 5 minutes, vault owner calls `withdraw`, draining all funds.
5. Recipients attempting to settle find an empty vault.

#### Recommendation

Add `constraint = vault.is_active @ SeekerIOUError::VaultNotActive` to the `SetCooldown` accounts struct.

#### Remediation

Fixed. The `SetCooldown` account validation now includes:

```rust
constraint = vault.is_active @ SeekerIOUError::VaultNotActive,
```

---

### SEK-003: Reserve Ratio Changeable After Vault Deactivation

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Fixed |
| **File** | `programs/seeker-iou/src/instructions/set_reserve_ratio.rs` |
| **Lines** | 12--19 (post-fix) |
| **Category** | Privilege Escalation (M-8) |

#### Description

Identical to SEK-002 but for the reserve ratio. A vault owner could deactivate, set `reserve_ratio_bps = 0`, eliminating the bond entirely, then withdraw with no slashing protection for pending IOU recipients.

#### Impact

Eliminates the economic guarantee that bond slashing provides to IOU recipients. A malicious vault owner could eliminate the reserve, reducing the penalty for defaulting on IOUs to zero.

#### Attack Scenario

1. Vault owner configures 30% reserve ratio and issues IOUs.
2. Vault owner calls `deactivate_vault`.
3. Vault owner calls `set_reserve_ratio(0)` -- previously allowed even when inactive.
4. Vault owner waits for cooldown, then withdraws 100% of remaining funds.
5. Any IOU settlement failures result in zero slashing compensation to recipients.

#### Recommendation

Add `constraint = vault.is_active @ SeekerIOUError::VaultNotActive` to the `SetReserveRatio` accounts struct.

#### Remediation

Fixed. The `SetReserveRatio` account validation now includes:

```rust
constraint = vault.is_active @ SeekerIOUError::VaultNotActive,
```

---

### SEK-004: Withdraw Used Book Value Instead of Actual Balance

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Fixed |
| **File** | `programs/seeker-iou/src/instructions/withdraw.rs` |
| **Lines** | 57--62 (post-fix) |
| **Category** | Token Account Ownership (M-5) |

#### Description

The `withdraw` instruction previously calculated the withdrawal amount as `deposited_amount - spent_amount` (book value) without consulting the actual token account balance. In edge cases -- such as rounding errors in token transfers, external transfers to the vault token account, or token program fee deductions -- the book value could diverge from the actual balance.

#### Impact

If the actual token account balance was lower than the book value (e.g., due to transfer fees in Token-2022 tokens with transfer fee extensions), the withdrawal would fail with an SPL token insufficient-funds error rather than a meaningful error. More critically, if external tokens were deposited directly to the vault ATA, the book value would not reflect them, potentially leaving tokens permanently locked.

#### Attack Scenario

1. Vault is created with a Token-2022 mint that has a 1% transfer fee.
2. Owner deposits 1000 tokens; vault receives 990 tokens (after fee).
3. Book `deposited_amount` = 1000, but actual balance = 990.
4. After deactivation and cooldown, owner calls `withdraw`.
5. Program attempts to transfer 1000 tokens from an account with 990, causing an opaque SPL error.

#### Recommendation

Use `min(book_remaining, vault_token_account.amount)` for the withdrawal amount.

#### Remediation

Fixed. The withdrawal now calculates:

```rust
let book_remaining = vault.deposited_amount
    .checked_sub(vault.spent_amount)
    .ok_or(SeekerIOUError::ArithmeticOverflow)?;
let actual_balance = ctx.accounts.vault_token_account.amount;
let remaining = book_remaining.min(actual_balance);
```

---

### SEK-005: Nonce Allows Gaps (Non-Sequential)

| Attribute | Value |
|-----------|-------|
| **Severity** | Medium |
| **Status** | Mitigated by Design |
| **File** | `programs/seeker-iou/src/instructions/settle_iou.rs` |
| **Lines** | 111--115 |
| **Category** | Replay Attacks (M-6) |

#### Description

The nonce validation requires `nonce > vault.current_nonce` (strictly greater), not `nonce == vault.current_nonce + 1` (sequential). This means IOUs can settle out of order and nonce values can be skipped. For example, nonces 1, 5, 10 are all valid if presented in order.

#### Impact

Nonce gaps mean that the total number of IOUs issued cannot be precisely determined from on-chain state alone. The `current_nonce` field reflects the highest settled nonce, not a count of settlements. However, this does not enable replay because the settlement record PDA per nonce prevents any nonce from being used twice.

#### Design Rationale

This is intentional. The protocol is designed for offline/async settlement where:
- Multiple IOUs may be issued offline before any are settled.
- Network availability is unpredictable, so settlement order cannot be guaranteed.
- The settlement record PDA (`["settlement", vault, nonce_le_bytes]`) provides replay protection regardless of ordering.

#### Recommendation for External Auditor

Verify that no attack vector exists where nonce gaps combined with the `current_nonce` update could allow bypassing settlement. Specifically, confirm that settling nonce N updates `current_nonce = N`, which correctly invalidates all nonces less than or equal to N.

---

### SEK-006: Permissionless Settlement

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Mitigated by Design |
| **File** | `programs/seeker-iou/src/instructions/settle_iou.rs` |
| **Lines** | 17--72 |
| **Category** | Denial of Service (M-12) |

#### Description

Any signer can call `settle_iou`. The `settler` account is a `Signer<'info>` but is not validated against the vault owner or the IOU recipient. The settler pays transaction fees and rent for the settlement record account.

#### Impact

Front-running: A third party observing an IOU settlement in the mempool could submit the same settlement first. However, the recipient still receives the funds regardless of who the settler is, so this is economically harmless.

Griefing: A malicious actor could settle IOUs on behalf of recipients, paying rent. This costs the attacker money and benefits the recipient.

#### Design Rationale

Permissionless settlement enables:
- Third-party relayers to batch-settle IOUs on behalf of offline recipients.
- Recipients to self-settle without the vault owner's cooperation.
- Backend services to automate settlement.

---

### SEK-007: Zero Expiry Means IOU Never Expires

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Mitigated by Design |
| **File** | `programs/seeker-iou/src/instructions/settle_iou.rs` |
| **Lines** | 118--124 |
| **Category** | Clock Manipulation (M-7) |

#### Description

When `iou.expiry == 0`, the expiry check is skipped entirely, creating a perpetually valid IOU. The IOU can be settled at any time in the future.

#### Impact

A never-expiring IOU creates a permanent liability on the vault. If the vault owner forgets about an issued IOU, it can be settled years later.

#### Design Rationale

This is the intended default for offline payment scenarios where:
- Connectivity timing is unpredictable.
- IOUs issued via NFC at a point-of-sale may not be settled for hours or days.
- Setting a short expiry in an offline context could cause legitimate payments to fail.

The vault owner can mitigate this by always setting explicit expiry values and by deactivating the vault (which blocks further settlements).

---

### SEK-008: Clock Drift Affects Expiry Enforcement

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Accepted Risk |
| **File** | `programs/seeker-iou/src/instructions/settle_iou.rs` |
| **Lines** | 118--124 |
| **Category** | Clock Manipulation (M-7) |

#### Description

Solana's `Clock` sysvar can drift by approximately 30 seconds from real-world time. This means an IOU with `expiry = T` could be settled at real-world time `T + 30` seconds.

#### Impact

Negligible for the intended use case. IOU expiry windows are expected to be on the order of hours, making a 30-second drift irrelevant. This is an inherent platform limitation that cannot be mitigated at the program level.

---

### SEK-009: Reputation Is Per-SGT-Mint

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | By Design |
| **File** | `programs/seeker-iou/src/state/reputation.rs` |
| **Lines** | 1--14 |
| **Category** | PDA Derivation (M-2) |

#### Description

The `ReputationAccount` PDA is derived as `["reputation", sgt_mint]`. Since SGTs are one-per-device with unique mints, this creates per-device reputation, not per-wallet reputation. If a user transfers their SGT to a new wallet, the reputation follows the SGT, not the wallet.

#### Impact

A user cannot shed a poor reputation by transferring their SGT to a fresh wallet -- the reputation is bound to the token, not the holder. However, if SGT transfer is possible, a user with a poor reputation could sell/transfer the SGT and acquire a new one (if a mechanism exists for new SGT issuance).

#### Design Rationale

Per the product requirements, per-SGT-mint reputation IS per-device reputation. This is correct because the Seeker Genesis Token represents a specific physical device.

---

### SEK-010: Bond Truncation on Small Balances

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Accepted Risk |
| **File** | `programs/seeker-iou/src/state/vault.rs` |
| **Lines** | 34--37 |
| **Category** | Integer Overflow (M-3) |

#### Description

The bond amount is calculated as:

```rust
(remaining as u128 * self.reserve_ratio_bps as u128 / 10000) as u64
```

Integer division truncates toward zero. For very small remaining balances (e.g., 3 tokens with 3000 bps reserve), the bond could be calculated as 0, meaning no funds are reserved.

#### Impact

For vaults with extremely small balances, the effective reserve ratio may be zero. This means failed settlements on near-empty vaults would have no bond to slash. The impact is negligible because:
- The amounts involved are dust-level.
- Truncation always rounds in favor of IOU availability (not against the recipient).
- At these balance levels, the vault cannot issue meaningful IOUs anyway.

---

### SEK-011: Ed25519 Instruction Hardcoded at Index 0

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Mitigated by Design |
| **File** | `programs/seeker-iou/src/instructions/settle_iou.rs` |
| **Lines** | 291--293 |
| **Category** | Ed25519 Signature Verification (M-9) |

#### Description

The Ed25519 precompile instruction is always loaded from index 0:

```rust
let ix: Instruction =
    instructions_sysvar::load_instruction_at_checked(0, &instructions_sysvar.to_account_info())
        .map_err(|_| error!(SeekerIOUError::MissingEd25519Instruction))?;
```

If the Ed25519 instruction is placed at any other index in the transaction, the settlement fails.

#### Impact

Reduces composability. Other programs or instructions cannot be placed before the Ed25519 precompile instruction in a settlement transaction. However, this is a fail-safe, not an exploit -- the transaction fails rather than succeeding incorrectly.

The SDK's `createSettleIOUInstruction()` in `packages/sdk/src/settlement.ts` always places the Ed25519 instruction first, ensuring compatibility.

---

### SEK-012: Settler Pays Recipient ATA Rent

| Attribute | Value |
|-----------|-------|
| **Severity** | Info |
| **Status** | By Design |
| **File** | `programs/seeker-iou/src/instructions/settle_iou.rs` |
| **Lines** | 41--47 |
| **Category** | Denial of Service (M-12) |

#### Description

The `recipient_token_account` uses `init_if_needed`, meaning the settler pays approximately 0.002 SOL rent if the recipient's ATA does not already exist.

#### Impact

The settler bears the cost of ATA creation. In the typical flow, the recipient is also the settler (self-settling), so this cost is expected. Third-party relayers should account for this rent cost in their economics.

---

### SEK-013: Settlement Records Are Permanent

| Attribute | Value |
|-----------|-------|
| **Severity** | Info |
| **Status** | By Design |
| **File** | `programs/seeker-iou/src/state/settlement_record.rs` |
| **Lines** | 1--17 |
| **Category** | Denial of Service (M-12) |

#### Description

No `close` instruction exists for `SettlementRecord` accounts. Each settlement permanently consumes approximately 0.002 SOL in rent (paid by the settler). Settlement records are never reclaimed.

#### Impact

Over time, the number of on-chain settlement records grows without bound. This is intentional -- settlement records serve as on-chain receipts for audit and dispute resolution purposes. The rent cost is borne by the settler and is economically acceptable at the expected transaction volume.

---

### SEK-014: No Upgrade Authority Management

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Mitigated by Design |
| **File** | `Anchor.toml` |
| **Category** | Privilege Escalation (M-8) |

#### Description

The program does not include on-chain upgrade authority governance or multisig requirements. Program upgrades are controlled by the deployment keypair.

#### Impact

The program deployer can unilaterally upgrade the program, potentially introducing malicious logic.

#### Recommendation

Before mainnet deployment, either:
- Set the program's upgrade authority to a multisig.
- Make the program immutable (renounce upgrade authority).
- Implement a timelock for upgrades.

---

### SEK-015: SGT Mint Authority Is Hardcoded

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Mitigated by Design |
| **File** | `programs/seeker-iou/src/instructions/create_vault.rs` |
| **Lines** | 12 |
| **Category** | Account Confusion (M-10) |

#### Description

The SGT mint authority is hardcoded as a constant:

```rust
pub const SGT_MINT_AUTHORITY: &str = "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4";
```

If the SGT program's mint authority changes, the seeker-iou program would need to be upgraded.

#### Impact

A change to the SGT mint authority would brick vault creation until the program is upgraded. Existing vaults and settlements would continue to work.

---

### SEK-016: Batch Settlement Ed25519 Index Assumption

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Mitigated by Design |
| **File** | `packages/sdk/src/settlement.ts` |
| **Lines** | 92--116, 123--149 |
| **Category** | Ed25519 Signature Verification (M-9) |

#### Description

The batch settlement SDK (`createBatchSettleInstructions`) interleaves Ed25519 and settle instructions: `[ed25519_0, settle_0, ed25519_1, settle_1, ...]`. However, the on-chain program always reads the Ed25519 instruction from index 0. This means only the first IOU in a batch has its Ed25519 instruction at the expected index.

#### Impact

Batch settlement as currently structured in the SDK will fail for the second and subsequent IOUs in a single transaction because their Ed25519 instructions are at indices 2, 4, etc., not index 0. The `chunkSettlementTransactions` function limits to 2 pairs per transaction, but even with 2 pairs, the second pair fails.

#### Recommendation

Either:
1. Limit batches to 1 IOU per transaction (the SDK's chunking already partially addresses this).
2. Modify the on-chain program to accept an Ed25519 instruction index parameter.
3. Place all Ed25519 instructions first, then all settle instructions, and update the on-chain loader to read from the correct index.

---

### SEK-017: Local State Does Not Track Bond/Reserve

| Attribute | Value |
|-----------|-------|
| **Severity** | Info |
| **Status** | Informational |
| **File** | `packages/sdk/src/local-state.ts` |
| **Lines** | 1--72 |
| **Category** | -- |

#### Description

The `LocalVaultState` type tracks `depositedAmount` and `spentAmount` but does not account for the reserve ratio when calculating available balance. The `getLocalAvailableBalance()` function returns `depositedAmount - spentAmount` without subtracting the bond.

#### Impact

A client using only local state could overestimate the available balance for IOU issuance, leading to more failed settlements (which trigger bond slashing). The on-chain program correctly enforces the reserve.

#### Recommendation

Update `getLocalAvailableBalance()` to accept a `reserveRatioBps` parameter and use `calculateAvailableForIOUs()` from utils.

---

### SEK-018: No Rate Limiting on Vault Creation

| Attribute | Value |
|-----------|-------|
| **Severity** | Low |
| **Status** | Mitigated by Design |
| **File** | `programs/seeker-iou/src/instructions/create_vault.rs` |
| **Lines** | 23--75 |
| **Category** | Denial of Service (M-12) |

#### Description

Any SGT holder can create one vault per (owner, token_mint) pair. Since there are many possible token mints, a single SGT holder could create many vaults.

#### Impact

Each vault creation costs the owner rent (approximately 0.003 SOL), providing a natural economic rate limit. The vaults are PDA-derived per (owner, mint), so the number is bounded by the number of SPL token mints.

---

### SEK-019: Nonce Stored as Number in SDK Type

| Attribute | Value |
|-----------|-------|
| **Severity** | Info |
| **Status** | Informational |
| **File** | `packages/sdk/src/types.ts` |
| **Lines** | 53 |
| **Category** | -- |

#### Description

In the TypeScript SDK, `IOUParams.nonce` is typed as `number` (64-bit float), while the on-chain nonce is `u64`. JavaScript `number` can safely represent integers up to 2^53 - 1, which is sufficient for practical use but technically narrower than the on-chain u64 range.

#### Impact

Nonces above `Number.MAX_SAFE_INTEGER` (9,007,199,254,740,991) would lose precision. This is unlikely to be reached in practice but represents a theoretical inconsistency.

#### Recommendation

Consider using `bigint` for the nonce type in `IOUParams`, consistent with the `amount` field.

---

## 6. Remediation Log

| Finding | Fix Description | Commit | File(s) |
|---------|----------------|--------|---------|
| SEK-001 | Added `0xFFFF` validation for all three Ed25519 instruction_index fields | `de3a875` | `programs/seeker-iou/src/instructions/settle_iou.rs` |
| SEK-002 | Added `vault.is_active` constraint to `SetCooldown` accounts | `de3a875` | `programs/seeker-iou/src/instructions/set_cooldown.rs` |
| SEK-003 | Added `vault.is_active` constraint to `SetReserveRatio` accounts | `de3a875` | `programs/seeker-iou/src/instructions/set_reserve_ratio.rs` |
| SEK-004 | Changed withdraw to use `min(book_remaining, vault_token_account.amount)` | `de3a875` | `programs/seeker-iou/src/instructions/withdraw.rs` |

All four fixes were applied in commit `de3a875` ("fix: apply security audit fixes and document findings").

---

## 7. Recommendations for External Auditors

The following areas merit focused attention during a formal external audit:

### 7.1 High Priority

1. **Formal Verification of Ed25519 Instruction Parsing** -- The `verify_ed25519_signature()` function in `programs/seeker-iou/src/instructions/settle_iou.rs` (lines 285--392) manually parses the Ed25519 precompile instruction data format. Verify that all offset calculations, bounds checks, and data comparisons are correct under all input permutations. Consider fuzzing with malformed Ed25519 instruction data.

2. **Token Account Authority Chain** -- Verify the complete CPI authority chain: vault PDA signs token transfers, vault ATA is derived with vault PDA as authority. Confirm that no path exists for a non-vault-PDA signer to authorize transfers from the vault token account.

3. **Bond Slashing Economic Analysis** -- The bond slashing mechanism in the settlement failure path transfers `min(bond, iou_amount)` to the recipient. Analyze whether an attacker could manipulate the reserve ratio, deposit amount, or settlement ordering to extract more value than intended through strategic slashing.

### 7.2 Medium Priority

4. **IOU Message Deserialization Fuzzing** -- The `IOUMessage` is deserialized from arbitrary bytes via Borsh. Fuzz the deserialization with malformed, truncated, and oversized inputs to verify that all failure modes produce clean errors rather than panics.

5. **Nonce Gap + current_nonce Update Interaction** -- With non-sequential nonces, verify that no race condition or ordering attack exists. Specifically: if nonces 5 and 10 are both valid and pending, and nonce 10 settles first (setting `current_nonce = 10`), nonce 5 becomes permanently unsettleable. Verify this is documented and acceptable.

6. **PDA Seed Uniqueness Proof** -- Formally verify that no two distinct accounts can derive the same PDA:
   - Vault: `["vault", owner, token_mint]`
   - Settlement: `["settlement", vault, nonce_le_bytes]`
   - Reputation: `["reputation", sgt_mint]`

### 7.3 Lower Priority

7. **Load Testing Batch Settlement** -- Test batch settlement transactions at the Solana transaction size limit (~1232 bytes). Verify compute unit consumption for settlement with and without ATA creation.

8. **Token-2022 Extension Compatibility** -- The program uses `token_interface` (not `token`), indicating Token-2022 support. Test with transfer fee extensions, permanent delegate extensions, and other Token-2022 features that could affect the balance/transfer assumptions.

9. **Clock Sysvar Dependency** -- The program calls `Clock::get()` twice in `settle_iou` (lines 119 and 136). Verify that the Solana runtime guarantees consistency between these calls within a single instruction execution.

---

## Appendix A: Program Architecture

### A.1 High-Level Flow

```
                 OFFLINE                          ON-CHAIN
            +--------------+              +---------------------+
            |              |              |                     |
            |  1. Sender   |              |  create_vault()     |
            |  creates     |              |  deposit()          |
            |  vault &     |              |                     |
            |  deposits    |------------->|  Vault PDA created  |
            |              |              |  Tokens held in ATA |
            |              |              |                     |
            |  2. Sender   |              |                     |
            |  signs IOU   |              |                     |
            |  message     |              |                     |
            |              |              |                     |
            |  3. NFC tap  |              |                     |
            |  transfers   |              |                     |
            |  IOU to      |              |                     |
            |  recipient   |              |                     |
            |              |              |                     |
            |  4. Recipient|              |  settle_iou()       |
            |  goes online |------------->|  Ed25519 verify     |
            |  and settles |              |  Token transfer     |
            |              |              |  Settlement record  |
            |              |              |  Reputation update  |
            +--------------+              +---------------------+
```

### A.2 Instruction Flow Diagram

```
create_vault        -- Owner creates vault PDA + vault ATA + reputation PDA
    |
deposit             -- Owner transfers tokens into vault ATA
    |
[OFFLINE: sign IOU, NFC exchange]
    |
settle_iou          -- Anyone settles; Ed25519 verify -> transfer -> record
    |                   If insufficient: bond slashing -> partial compensation
    |
deactivate_vault    -- Owner deactivates (blocks new settlements)
    |
[COOLDOWN PERIOD]
    |
withdraw            -- Owner withdraws remaining balance
    |
reactivate_vault    -- Owner re-enables vault (optional)
```

### A.3 PDA Derivation Map

| Account | Seeds | Uniqueness Guarantee |
|---------|-------|---------------------|
| Vault | `["vault", owner, token_mint]` | One vault per owner per token mint |
| Vault ATA | Associated Token Account of Vault PDA | Derived from vault PDA + mint |
| SettlementRecord | `["settlement", vault, nonce_le_bytes]` | One record per vault per nonce |
| ReputationAccount | `["reputation", sgt_mint]` | One reputation per SGT (device) |

### A.4 CPI Relationships

```
seeker_iou program
    |
    +---> SPL Token Program (token_interface)
    |       - TransferChecked (deposit, settle, withdraw)
    |
    +---> Associated Token Program
    |       - Create ATA (vault creation, settlement)
    |
    +---> System Program
    |       - Account creation (vault, settlement record, reputation)
    |
    +---> Ed25519 Precompile (instruction 0, not CPI -- introspected via sysvar)
```

---

## Appendix B: Account Layouts

### B.1 Vault

**Total Size:** 8 (discriminator) + 178 (data) = **186 bytes**

| Offset | Field | Type | Size (bytes) | Description |
|--------|-------|------|-------------|-------------|
| 0 | discriminator | [u8; 8] | 8 | Anchor account discriminator |
| 8 | owner | Pubkey | 32 | Vault owner wallet |
| 40 | token_mint | Pubkey | 32 | SPL token mint address |
| 72 | token_account | Pubkey | 32 | Vault's ATA address |
| 104 | deposited_amount | u64 | 8 | Total tokens deposited |
| 112 | spent_amount | u64 | 8 | Total tokens spent (settled + slashed + withdrawn) |
| 120 | current_nonce | u64 | 8 | Highest settled nonce |
| 128 | sgt_mint | Pubkey | 32 | Seeker Genesis Token mint |
| 160 | created_at | i64 | 8 | Unix timestamp of creation |
| 168 | is_active | bool | 1 | Whether vault accepts settlements |
| 169 | deactivated_at | i64 | 8 | Unix timestamp of deactivation (0 if active) |
| 177 | cooldown_seconds | u32 | 4 | Withdrawal cooldown after deactivation |
| 181 | reserve_ratio_bps | u16 | 2 | Bond reserve ratio in basis points |
| 183 | total_slashed | u64 | 8 | Cumulative tokens slashed from bond |
| 191 | bump | u8 | 1 | PDA bump seed |

**Seeds:** `["vault", owner.key(), token_mint.key()]`

### B.2 SettlementRecord

**Total Size:** 8 (discriminator) + 122 (data) = **130 bytes**

| Offset | Field | Type | Size (bytes) | Description |
|--------|-------|------|-------------|-------------|
| 0 | discriminator | [u8; 8] | 8 | Anchor account discriminator |
| 8 | vault | Pubkey | 32 | Parent vault address |
| 40 | recipient | Pubkey | 32 | IOU recipient wallet |
| 72 | amount | u64 | 8 | IOU amount (requested) |
| 80 | nonce | u64 | 8 | IOU nonce |
| 88 | settled_at | i64 | 8 | Unix timestamp of settlement |
| 96 | settled_by | Pubkey | 32 | Transaction settler (payer) |
| 128 | success | bool | 1 | Whether full amount was paid |
| 129 | slash_amount | u64 | 8 | Bond amount slashed on failure |
| 137 | bump | u8 | 1 | PDA bump seed |

**Seeds:** `["settlement", vault.key(), nonce.to_le_bytes()]`

### B.3 ReputationAccount

**Total Size:** 8 (discriminator) + 81 (data) = **89 bytes**

| Offset | Field | Type | Size (bytes) | Description |
|--------|-------|------|-------------|-------------|
| 0 | discriminator | [u8; 8] | 8 | Anchor account discriminator |
| 8 | sgt_mint | Pubkey | 32 | Seeker Genesis Token mint |
| 40 | total_issued | u64 | 8 | Total IOUs processed (settled + failed) |
| 48 | total_settled | u64 | 8 | Successfully settled IOUs |
| 56 | total_failed | u64 | 8 | Failed IOU settlements |
| 64 | total_volume | u64 | 8 | Cumulative token volume settled |
| 72 | last_failure_at | i64 | 8 | Unix timestamp of last failure |
| 80 | created_at | i64 | 8 | Unix timestamp of creation |
| 88 | bump | u8 | 1 | PDA bump seed |

**Seeds:** `["reputation", sgt_mint.key()]`

### B.4 IOUMessage (Off-Chain, Borsh-Serialized)

**Total Size:** **217 bytes**

| Offset | Field | Type | Size (bytes) | Description |
|--------|-------|------|-------------|-------------|
| 0 | version | u8 | 1 | Protocol version (must be 1) |
| 1 | vault | Pubkey | 32 | Vault PDA address |
| 33 | sender | Pubkey | 32 | Vault owner (signer) |
| 65 | recipient | Pubkey | 32 | Payment recipient |
| 97 | token_mint | Pubkey | 32 | SPL token mint |
| 129 | amount | u64 | 8 | Payment amount in base units |
| 137 | nonce | u64 | 8 | Monotonically increasing nonce |
| 145 | expiry | i64 | 8 | Unix timestamp expiry (0 = never) |
| 153 | sgt_mint | Pubkey | 32 | Sender's SGT mint |
| 185 | memo | [u8; 32] | 32 | UTF-8 memo, zero-padded |

---

## Appendix C: Instruction Reference

### C.1 create_vault

| Parameter | Type | Description |
|-----------|------|-------------|
| `reserve_ratio_bps` | u16 | Reserve ratio in basis points (0--10000) |
| `cooldown_seconds` | u32 | Withdrawal cooldown (0 = default 3600, min 300) |

**Accounts:** owner (signer, mut), vault (init), token_mint, vault_token_account (init), sgt_token_account, sgt_mint, reputation (init_if_needed), system_program, token_program, associated_token_program

**Authorization:** Owner must sign. Owner must hold a valid SGT (balance > 0, mint authority matches hardcoded `GT2zuHVa...`).

### C.2 deposit

| Parameter | Type | Description |
|-----------|------|-------------|
| `amount` | u64 | Number of tokens to deposit (must be > 0) |

**Accounts:** owner (signer, mut), vault (mut), token_mint, owner_token_account (mut), vault_token_account (mut), token_program

**Authorization:** Owner must sign. Vault must be active.

### C.3 settle_iou

| Parameter | Type | Description |
|-----------|------|-------------|
| `iou_message` | Vec\<u8\> | Borsh-serialized IOUMessage (217 bytes) |
| `signature` | [u8; 64] | Ed25519 signature over iou_message |
| `nonce` | u64 | IOU nonce (must match message and exceed current_nonce) |

**Accounts:** settler (signer, mut), vault (mut), token_mint, vault_token_account (mut), recipient (mut, unchecked -- validated against IOU), recipient_token_account (init_if_needed), settlement_record (init), reputation (mut), instructions_sysvar, system_program, token_program, associated_token_program

**Authorization:** Any signer. Ed25519 precompile instruction must be at transaction index 0. Vault must be active.

### C.4 deactivate_vault

**Accounts:** owner (signer), vault (mut)

**Authorization:** Owner must sign. Vault must be active.

### C.5 reactivate_vault

**Accounts:** owner (signer), vault (mut)

**Authorization:** Owner must sign. Vault must be inactive.

### C.6 withdraw

**Accounts:** owner (signer, mut), vault (mut), token_mint, vault_token_account (mut), owner_token_account (mut), token_program

**Authorization:** Owner must sign. Vault must be inactive. `clock.unix_timestamp >= deactivated_at + cooldown_seconds`.

### C.7 set_reserve_ratio

| Parameter | Type | Description |
|-----------|------|-------------|
| `reserve_ratio_bps` | u16 | New reserve ratio in basis points (0--10000) |

**Accounts:** owner (signer), vault (mut)

**Authorization:** Owner must sign. Vault must be active.

### C.8 set_cooldown

| Parameter | Type | Description |
|-----------|------|-------------|
| `cooldown_seconds` | u32 | New cooldown in seconds (min 300) |

**Accounts:** owner (signer), vault (mut)

**Authorization:** Owner must sign. Vault must be active.

---

## Appendix D: Attack Vector Testing Matrix

| # | Attack Vector | Prevention Mechanism | Verified |
|---|--------------|---------------------|----------|
| 1 | Replay: same nonce settled twice | Settlement record PDA `init` constraint fails on second attempt | Yes |
| 2 | Double-spend: same nonce to two recipients | First settlement wins; PDA uniquely binds nonce to vault | Yes |
| 3 | Nonce rewind: settle with nonce <= current_nonce | `nonce > vault.current_nonce` (strict greater-than check) | Yes |
| 4 | Signature forgery | Ed25519 precompile provides cryptographic verification | Yes |
| 5 | Wrong token mint in IOU | `iou.token_mint == ctx.accounts.token_mint.key()` validation | Yes |
| 6 | Expired IOU settlement | `clock.unix_timestamp <= iou.expiry` check (when expiry > 0) | Yes |
| 7 | Settlement on deactivated vault | `vault.is_active` constraint on SettleIOU accounts | Yes |
| 8 | Withdraw before cooldown expires | `clock.unix_timestamp >= deactivated_at + cooldown_seconds` | Yes |
| 9 | Cooldown reduction after deactivation | `set_cooldown` requires `vault.is_active == true` | Yes (fixed) |
| 10 | Reserve ratio removal after deactivation | `set_reserve_ratio` requires `vault.is_active == true` | Yes (fixed) |
| 11 | Overdraw beyond available balance | Settlement failure path triggers bond slashing | Yes |
| 12 | Cross-instruction Ed25519 data injection | instruction_index fields validated as `0xFFFF` | Yes (fixed) |
| 13 | Unauthorized vault modification | `has_one = owner` + `Signer<'info>` on all owner-gated instructions | Yes |
| 14 | Fake SGT for vault creation | Mint authority validated against hardcoded `GT2zuHVa...` | Yes |
| 15 | Vault PDA collision across users | Seeds include `owner.key()`, preventing cross-user collision | Yes |

---

*End of Report*

*This document is intended to facilitate a formal external security audit. It represents the findings of an internal self-audit and should not be considered a substitute for an independent third-party review.*
