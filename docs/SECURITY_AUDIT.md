# Security Self-Audit: seeker-iou

**Date:** 2026-03-23
**Auditor:** Self-audit (automated + manual review)
**Scope:** All on-chain instructions, account structs, PDA derivation, CPI calls

---

## Summary

22 findings identified. 4 required code fixes (applied). Remaining findings are mitigated by design or low severity.

| Severity | Count | Fixed | Mitigated | By Design |
|----------|-------|-------|-----------|-----------|
| Critical | 0     | -     | -         | -         |
| High     | 0     | -     | -         | -         |
| Medium   | 5     | 3     | 1         | 1         |
| Low      | 10    | 1     | 7         | 2         |
| Info     | 4     | -     | -         | 4         |

---

## Fixes Applied

### FIX 1: Ed25519 instruction_index fields not validated (Medium)

**Before:** The Ed25519 signature verification only checked offsets, not the `instruction_index` fields. An attacker could craft a transaction where the Ed25519 precompile reads data from a different instruction.

**After:** Added validation that `signature_instruction_index`, `public_key_instruction_index`, and `message_instruction_index` are all `0xFFFF` (inline data).

**File:** `instructions/settle_iou.rs`

### FIX 2: Cooldown and reserve ratio changeable after deactivation (Medium)

**Before:** A vault owner could deactivate, reduce cooldown to 300s and reserve to 0%, then withdraw quickly — defeating anti-cheat protections.

**After:** Both `set_cooldown` and `set_reserve_ratio` now require `vault.is_active == true`.

**Files:** `instructions/set_cooldown.rs`, `instructions/set_reserve_ratio.rs`

### FIX 3: Withdraw used book value instead of actual balance (Medium)

**Before:** `withdraw` calculated remaining as `deposited_amount - spent_amount`, ignoring the actual token account balance.

**After:** Uses `min(book_remaining, vault_token_account.amount)` to handle edge cases (rounding, external transfers).

**File:** `instructions/withdraw.rs`

---

## Mitigated by Design

### Nonce allows gaps (Medium)

Nonces are strictly-greater-than, not sequential. This means IOUs can settle out of order and nonces can be skipped. This is intentional for offline/async settlement where ordering is unpredictable. The settlement record PDA per nonce prevents replay regardless of order.

### Permissionless settlement (Info)

Any signer can call `settle_iou`. This enables third-party relayers and batch settlement. The settler pays gas and account rent. Front-running is possible but harmless (the correct recipient still receives funds).

### Zero expiry = never expires (Low)

IOUs with `expiry = 0` are valid indefinitely. This is the intended default for offline payments where connectivity timing is unknown.

### Clock manipulation on expiry (Low)

Solana validator clock can drift ~30 seconds. IOU expiry windows should be hours, not seconds. Inherent platform limitation.

### Reputation is per-SGT-mint (Not a bug)

SGTs are one per device with unique mints. Per-SGT-mint reputation IS per-device reputation. This is correct per the PRD.

---

## Informational Notes

### Settler pays recipient ATA rent

When settling, if the recipient's associated token account doesn't exist, the settler pays ~0.002 SOL rent. Expected behavior — settlers are typically the recipients themselves.

### Settlement records are permanent

No close instruction exists for settlement records. Each costs ~0.002 SOL rent (paid by settler). This is intentional for auditability — records serve as on-chain receipts.

### Bond truncation on small balances

`bond_amount = remaining * ratio / 10000` uses integer division. Balances under ~3 tokens (with 3000 bps reserve) may have zero effective bond. Acceptable — rounds in favor of IOU availability.

### Ed25519 verification at instruction index 0

The program hardcodes instruction index 0 for Ed25519 verification. Passing the Ed25519 instruction at a different index causes the settlement to fail (not succeed incorrectly). Reduces composability but is not exploitable.

---

## Attack Vectors Tested

| Attack | Prevention |
|--------|-----------|
| Replay (same nonce twice) | Settlement record PDA already exists |
| Double-spend (same nonce to two recipients) | First to settle wins, nonce consumed |
| Nonce rewind | `nonce > vault.current_nonce` (strict) |
| Signature forgery | Ed25519 precompile cryptographic verification |
| Wrong token mint | IOU message validation + PDA seed derivation |
| Expired IOU | Clock check against `iou.expiry` |
| Deactivated vault settlement | `vault.is_active` constraint |
| Withdraw before cooldown | `Clock >= deactivated_at + cooldown_seconds` |
| Cooldown reduction after deactivation | `set_cooldown` requires active vault |
| Reserve ratio removal after deactivation | `set_reserve_ratio` requires active vault |
| Overdraw beyond available balance | Bond slashing compensates recipient |
| Cross-instruction Ed25519 data injection | instruction_index fields must be 0xFFFF |

---

## Recommendations for External Audit

1. Formal verification of the Ed25519 instruction parsing logic
2. Fuzzing of IOU message deserialization with malformed inputs
3. Review of token account authority chain (vault PDA → ATA)
4. Economic analysis of bond slashing incentives at various reserve ratios
5. Load testing batch settlement at transaction size limits
