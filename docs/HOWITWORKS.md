# How seeker-iou Works

## The Setup (Online, Once)

```
┌──────────────────────────────────────────────────────────┐
│  ALICE has a Seeker phone. She wants to pay at a market  │
│  tomorrow where there's no internet.                      │
│                                                            │
│  Tonight, while she has WiFi:                              │
│                                                            │
│  1. Her app calls verifySGT() → confirms she owns an SGT  │
│     (one per Seeker device, hardware-tied identity)        │
│                                                            │
│  2. createVault(owner=Alice, tokenMint=USDC, reserve=30%) │
│     → Creates on-chain PDA: [b"vault", alice, usdc]        │
│     → Creates reputation PDA: [b"reputation", sgt_mint]    │
│     → Sets 30% reserve as anti-cheat bond                  │
│                                                            │
│  3. deposit(vault, 100 USDC)                               │
│     → Transfers 100 USDC from Alice's wallet → vault ATA   │
│     → vault.deposited_amount = 100                         │
│     → Available for IOUs: 70 USDC (30 USDC locked as bond) │
│                                                            │
│  4. App saves LocalVaultState to phone storage:            │
│     { depositedAmount: 100, spentAmount: 0, nonce: 0 }    │
│                                                            │
│  Alice puts her phone in airplane mode. Ready.             │
└──────────────────────────────────────────────────────────┘
```

## The Payment (Offline, NFC Tap)

```
┌──────────────────────────────────────────────────────────┐
│  Next morning. No signal. Alice buys mangoes from Bob.    │
│                                                            │
│  ALICE'S PHONE:                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ createIOUMessage({                                   │  │
│  │   vault: alice_vault_pda,                            │  │
│  │   sender: alice_wallet,                              │  │
│  │   recipient: bob_wallet,                             │  │
│  │   tokenMint: USDC,                                   │  │
│  │   amount: 5_000_000 (5 USDC),                       │  │
│  │   nonce: 1,          ← increments per IOU            │  │
│  │   sgtMint: alice_sgt,                                │  │
│  │   memo: "mangoes"                                    │  │
│  │ })                                                   │  │
│  │ → 217 bytes (Borsh serialized)                       │  │
│  │                                                       │  │
│  │ Seed Vault signs it (hardware Ed25519)               │  │
│  │ → 64 byte signature                                  │  │
│  │                                                       │  │
│  │ encodeNFCPayload({ message, signature })             │  │
│  │ → 281 bytes wrapped in NDEF record                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  Alice taps her Seeker against Bob's Seeker               │
│                     📱 ← NFC → 📱                         │
│                                                            │
│  BOB'S PHONE:                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ decodeNFCPayload(nfcBytes)                           │  │
│  │ → { message, signature }                             │  │
│  │                                                       │  │
│  │ verifySignature(message, signature, alice_pubkey)    │  │
│  │ → true (Ed25519 valid)                               │  │
│  │                                                       │  │
│  │ Check cached reputation for alice's SGT:             │  │
│  │ → trust score: 1.0 (perfect record)                  │  │
│  │                                                       │  │
│  │ Check cached vault balance: 100 USDC deposited       │  │
│  │ → IOU is 5 USDC of 100 USDC vault. Looks safe.      │  │
│  │                                                       │  │
│  │ Bob accepts. Stores the IOU locally.                 │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ALICE'S PHONE updates local state:                        │
│  trackIssuedIOU(state, iou)                                │
│  → spentAmount: 0 → 5, nonce: 0 → 1                       │
│  → getLocalAvailableBalance() = 65 USDC left for IOUs     │
│                                                            │
│  Alice walks to the next vendor. Repeats.                  │
│  Nonce 2: chai (2 USDC). Nonce 3: rice (10 USDC). ...     │
│  No internet needed at any point.                          │
└──────────────────────────────────────────────────────────┘
```

## The Settlement (Online, Batched)

```
┌──────────────────────────────────────────────────────────┐
│  Three days later. Bob gets WiFi. He has 12 IOUs from     │
│  different people. He submits them all.                    │
│                                                            │
│  For each IOU, the SDK builds TWO instructions:            │
│                                                            │
│  Instruction 1: Ed25519Program.verify(pubkey, msg, sig)   │
│  Instruction 2: settle_iou(vault, iou_message, sig, nonce)│
│                                                            │
│  Both go in the same transaction. ~2 IOUs fit per tx.      │
│  chunkSettlementTransactions() splits 12 IOUs → 6 txs.    │
│                                                            │
│  ON-CHAIN (settle_iou instruction):                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  1. Read Ed25519 instruction from sysvar              │  │
│  │     → Verify instruction_index fields are 0xFFFF      │  │
│  │     → Verify pubkey matches IOU sender                │  │
│  │     → Verify signature matches                        │  │
│  │     → Verify message matches                          │  │
│  │     ✓ Signature is cryptographically valid             │  │
│  │                                                       │  │
│  │  2. Deserialize IOU (217 bytes Borsh)                 │  │
│  │     → Verify vault PDA matches                        │  │
│  │     → Verify sender == vault.owner                    │  │
│  │     → Verify recipient matches account                │  │
│  │     → Verify token_mint matches vault                 │  │
│  │     → Verify sgt_mint matches vault                   │  │
│  │                                                       │  │
│  │  3. Nonce check: nonce(1) > vault.current_nonce(0)    │  │
│  │     ✓ Not a replay                                     │  │
│  │                                                       │  │
│  │  4. Expiry check: 0 = no expiry                       │  │
│  │     ✓ Still valid                                      │  │
│  │                                                       │  │
│  │  5. Balance check (with reserve):                     │  │
│  │     remaining = 100 - 0 = 100 USDC                    │  │
│  │     bond = 100 * 30% = 30 USDC                        │  │
│  │     available = 100 - 30 = 70 USDC                    │  │
│  │     5 USDC <= 70 USDC ✓                               │  │
│  │                                                       │  │
│  │  6. SUCCESS PATH:                                     │  │
│  │     → Transfer 5 USDC: vault ATA → bob ATA            │  │
│  │     → vault.spent_amount += 5                         │  │
│  │     → vault.current_nonce = 1                         │  │
│  │     → Create SettlementRecord PDA (prevents replay)   │  │
│  │     → reputation.total_settled += 1                   │  │
│  │     → reputation.total_volume += 5                    │  │
│  │     → Emit IOUSettled event                           │  │
│  │                                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  Bob now has 5 USDC in his wallet. On-chain receipt exists.│
└──────────────────────────────────────────────────────────┘
```

## What Happens When Someone Cheats

```
┌──────────────────────────────────────────────────────────┐
│  SCENARIO: Alice issued 15 IOUs totaling 80 USDC, but    │
│  her vault only has 70 USDC available (100 - 30 bond).    │
│  IOUs 1-14 settled fine. IOU #15 (10 USDC) overdrafts.    │
│                                                            │
│  ON-CHAIN (IOU #15, nonce 15):                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Signature valid ✓                                    │  │
│  │  Nonce valid ✓                                        │  │
│  │  Balance check:                                       │  │
│  │    remaining = 100 - 70 = 30 USDC (all bond)          │  │
│  │    bond = 30 * 30% = 9 USDC                           │  │
│  │    available = 30 - 9 = 21 USDC                       │  │
│  │    10 USDC <= 21 USDC ✓ (still fits!)                 │  │
│  │                                                       │  │
│  │  Actually settles. But IOU #16 would fail:            │  │
│  │    remaining = 100 - 80 = 20 USDC                     │  │
│  │    bond = 20 * 30% = 6 USDC                           │  │
│  │    available = 20 - 6 = 14 USDC                       │  │
│  │    IOU #16 is 15 USDC > 14 USDC available             │  │
│  │                                                       │  │
│  │  FAILURE PATH — BOND SLASHING:                        │  │
│  │    → slash_amount = min(bond=6, iou=15) = 6 USDC      │  │
│  │    → Transfer 6 USDC from vault → recipient           │  │
│  │    → vault.total_slashed += 6                         │  │
│  │    → Create SettlementRecord (success=false, slash=6)  │  │
│  │    → reputation.total_failed += 1                     │  │
│  │    → reputation.last_failure_at = now                  │  │
│  │    → Emit IOUFailed { slash_amount: 6 }               │  │
│  │                                                       │  │
│  │  Recipient gets 6 USDC partial compensation.          │  │
│  │  Alice's trust score drops: 15/16 = 0.9375            │  │
│  │  That score follows her SGT forever.                  │  │
│  └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## Vault Lifecycle (Withdrawal)

```
┌──────────────────────────────────────────────────────────┐
│  Alice wants her remaining USDC back.                     │
│                                                            │
│  1. deactivate_vault()                                     │
│     → vault.is_active = false                              │
│     → vault.deactivated_at = now                           │
│     → No more IOUs can settle against this vault           │
│     → BUT: 1-hour cooldown starts                          │
│                                                            │
│  2. During cooldown:                                       │
│     → Alice cannot withdraw yet (CooldownNotElapsed)       │
│     → Alice cannot change cooldown (VaultNotActive)        │
│     → Alice cannot change reserve ratio (VaultNotActive)   │
│     → Pending IOU holders have 1 hour to settle            │
│                                                            │
│  3. After 1 hour:                                          │
│     withdraw()                                             │
│     → remaining = min(book_value, actual_balance)          │
│     → Transfer remaining USDC → Alice's wallet             │
│     → Done.                                                │
│                                                            │
│  OR: Alice changes her mind:                               │
│     reactivate_vault()                                     │
│     → vault.is_active = true, deactivated_at = 0           │
│     → Vault is live again for IOUs                         │
└──────────────────────────────────────────────────────────┘
```

## The Anti-Cheat Stack

```
Layer 1: HARDWARE         Seed Vault signs IOUs — can't be faked
Layer 2: IDENTITY          SGT ties wallet to physical device — can't make new accounts
Layer 3: NONCE             Sequential — can't replay or double-spend
Layer 4: REPUTATION        Failed settlements permanently reduce trust score
Layer 5: BOND              30% reserve slashed on failure — cheating costs money
Layer 6: COOLDOWN          Can't drain vault instantly after issuing IOUs
Layer 7: CLIENT-SIDE       App checks cached balance + trust score before accepting
```

## Data Flow Summary

```
OFFLINE                          ONLINE
───────                          ──────

createIOUMessage()               createSettleIOUInstruction()
       │                                │
  Seed Vault signs                 [Ed25519Ix, SettleIx]
       │                                │
  encodeNFCPayload()               sendTransaction()
       │                                │
   NFC tap ──────────────────→    Solana validator
       │                                │
  decodeNFCPayload()              settle_iou handler
       │                                │
  verifySignature()               verify sig + nonce + balance
       │                                │
  trackIssuedIOU()                transfer tokens + record + reputation
```
