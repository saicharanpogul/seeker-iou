# seeker-iou

[![npm version](https://img.shields.io/npm/v/seeker-iou.svg)](https://www.npmjs.com/package/seeker-iou)
[![CI](https://github.com/saicharanpogul/seeker-iou/actions/workflows/ci.yml/badge.svg)](https://github.com/saicharanpogul/seeker-iou/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Anchor](https://img.shields.io/badge/Anchor-0.31.1-blueviolet)](https://www.anchor-lang.com/)
[![Solana](https://img.shields.io/badge/Solana-2.2.20-14F195?logo=solana)](https://solana.com)
[![Formally Verified](https://img.shields.io/badge/Formally_Verified-Lean_4-orange)](formal_verification/SPEC.md)

**Offline payment infrastructure for Solana Seeker. Vault-based IOUs exchanged over NFC. Settles on-chain when connectivity returns.**

| | |
|---|---|
| **Program ID** | `Appq4U1rTS4tCo4E84qhQs777z3awXf6K55amgnZ5srC` |
| **SDK** | [`seeker-iou` on npm](https://www.npmjs.com/package/seeker-iou) |
| **Framework** | Anchor 0.31.1 |
| **Tests** | 62 passing (28 Anchor + 34 SDK) |
| **Security** | [Self-audit report](docs/AUDIT_REPORT.md) (22 findings, 4 fixes applied) |
| **Formal Verification** | [12/13 properties proven](formal_verification/SPEC.md) in Lean 4 (0 `sorry`) |
| **How it works** | [Detailed walkthrough](docs/HOWITWORKS.md) |

---

## Why this exists

On February 28, 2026, the United States and Israel launched strikes on Iran. Within hours, internet connectivity across the country dropped to 4% of normal levels. By the next day, it fell to 1%. As of March 22, over three weeks later, the blackout persists. Ninety million people have been living with near-zero connectivity for 23 consecutive days.

**Sources:**
- NetBlocks confirmed connectivity at 4% on Feb 28 ([tweet](https://x.com/netblocks/status/2027658406127960133)), at 1% by Mar 2 ([CNBC](https://www.cnbc.com/2026/03/02/irans-internet-down-amid-reports-of-us-israel-cyberattacks.html)), and still at 1% at hour 444 on Mar 18 ([tweet](https://x.com/netblocks/status/2034364834607693873))
- Iran International reported the blackout exceeded 240 hours, making it one of the most severe government-imposed shutdowns globally ([source](https://www.iranintl.com/en/202603101193))
- The National reported Iranians have spent roughly one-third of 2026 in complete digital darkness ([source](https://www.thenationalnews.com/future/technology/2026/03/10/is-iran-internet-still-down/))
- Iran's communications minister estimated the daily economic cost at $35.7 million ([Wikipedia](https://en.wikipedia.org/wiki/2026_Internet_blackout_in_Iran))

ATMs need connectivity. Card terminals need connectivity. Mobile wallets need connectivity. Bank apps need connectivity. Every digital payment system ever built assumes the network is there. When that assumption breaks, all of them break. At once. For everyone.

This isn't new. Ukraine in 2022: strikes destroyed telecom infrastructure, ATMs and card terminals went dark. Sudan in 2023: civil war collapsed networks across Khartoum. Turkey in 2023: earthquake leveled cell infrastructure in the southeast. Myanmar under the junta routinely cuts internet during operations. Iran itself did this in January 2026 during protests ([TechCrunch](https://techcrunch.com/2026/01/08/internet-collapses-in-iran-amid-protests-over-economic-crisis/)), in June 2025, in 2022, and in 2019.

Every year, hundreds of millions of people temporarily lose the ability to move money electronically.

Cash was humanity's offline payment protocol for 5,000 years. We're abandoning it before we've built a replacement.

**seeker-iou is that replacement.**

## How it works

The mental model is a bar tab.

You walk into a bar. You hand the bartender your credit card. They hold it and open a tab. That's the **vault deposit**. Your money is locked. You can't use that card elsewhere.

You order drinks all night. Each drink, the bartender writes it on your tab. No card swipe each time. Just a note. Those notes are **IOUs**. No money moved yet. Just signed promises.

At the end of the night, the bartender closes your tab. One charge. Everything settles. That's the **on-chain settlement**.

Now translate this to two Seekers at a market with no internet:

**Phase 1: Load your vault (online, once)**

While you have signal, deposit tokens (SKR, USDC, any SPL token) into an on-chain vault. The funds are locked. Think of it like withdrawing cash from an ATM before walking into a market with no connectivity.

**Phase 2: Tap to pay (offline, unlimited)**

Tap your Seeker against another Seeker via NFC. Your Seed Vault signs an IOU at the hardware level. The signed promise transfers to the recipient's phone. No internet. No RPC. No validators. Just two phones touching and a fingerprint.

The recipient's phone stores the IOU. Your phone decrements your local balance and increments your nonce. You walk to the next vendor and do it again.

**Phase 3: Settle (online, batched)**

When anyone reconnects, they submit collected IOUs to the Solana program. The program verifies every signature, checks nonces, and transfers funds from vaults to recipients. One batch. On Solana. At Solana speed. Three weeks of a village economy settling in under a second.

> **[See the detailed step-by-step walkthrough with diagrams](docs/HOWITWORKS.md)**

## Why Seeker

This can only exist on Seeker. Every component depends on hardware no other phone has.

**Seed Vault** signs IOUs at the hardware level. Even if the app is compromised, the signatures are tamper-proof. In Iran right now, cyberattacks are running alongside kinetic strikes. CrowdStrike confirmed Iranian-aligned threat actors are already conducting reconnaissance and launching attacks ([CNBC](https://www.cnbc.com/2026/03/02/irans-internet-down-amid-reports-of-us-israel-cyberattacks.html)). When cyber and physical warfare happen simultaneously, hardware-signed promises are the only kind you can trust.

**SGT (Seeker Genesis Token)** ties every participant to a unique physical device. One person, one identity, one reputation. If someone writes IOUs they can't cover, that failure follows their device forever. No new accounts. No fresh starts.

**NFC** makes the transfer physical. Two phones touch. Fingerprint confirms. Two seconds. No QR codes to scan, no addresses to type, no wallet apps to connect.

**.skr domains** make it human. You see "mango-vendor.skr" not "7xK9m...3fP2".

## Anti-cheat

Offline payments have a fundamental trust problem: without network state, you can't verify someone's balance in real time. seeker-iou solves this through seven layers of accountability:

1. **Hardware signing**: Seed Vault signs IOUs at the hardware level. Can't be faked even with compromised software.
2. **Device identity**: SGT ties wallet to physical device. Can't create new accounts.
3. **Nonce ordering**: Sequential IOUs prevent replay and double-spend. First to settle wins.
4. **SGT-linked reputation**: Every settlement (success or failure) permanently updates the sender's trust score.
5. **Bond / overcollateralization**: Reserve ratio locks a percentage of vault funds as bond. Slashed on failed settlements to partially compensate cheated recipients.
6. **Deactivation cooldown**: Vault owners can't instantly drain funds after issuing IOUs. Configurable cooldown (min 5 min, default 1 hour) gives IOU holders time to settle.
7. **Client-side risk tiers**: Apps check cached balance + trust score before accepting. Configurable thresholds per merchant.

None of this is trustless. That's impossible offline. But it creates accountability strong enough for the use case: neighbors trading essentials during a crisis.

## The bigger picture

Solana proved money can move at the speed of light. Solana Pay proved it can move with a tap. seeker-iou proves it can move when there's no signal at all.

This isn't a replacement for Solana Pay. It's an extension to the places Solana Pay can't reach yet. When you have signal, use Solana Pay. When you don't, use seeker-iou. When you reconnect, it all settles on the same chain.

**Solana built the fastest settlement layer on earth. seeker-iou makes sure it still works at zero bandwidth.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Solana Program                         │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │   Vault   │  │Settlement│  │    Reputation         │  │
│  │  Account  │  │  Record  │  │    Account            │  │
│  └───────────┘  └──────────┘  └──────────────────────┘  │
│                                                           │
│  Instructions:                                            │
│  create_vault → deposit → settle_iou                      │
│  deactivate_vault → withdraw                              │
│  reactivate_vault → set_reserve_ratio → set_cooldown      │
└───────────────────────────────┬──────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────┐
│                    TypeScript SDK (npm: seeker-iou)        │
│  ┌─────┐ ┌─────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ IOU │ │ NFC │ │Settlement│ │Reputation│ │  Local  │ │
│  │     │ │     │ │ Builder  │ │  Query   │ │  State  │ │
│  └─────┘ └─────┘ └──────────┘ └──────────┘ └─────────┘ │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │  Seeker  │ │ Verification │ │   Vault Builders     │ │
│  │  (SGT)   │ │  (Ed25519)   │ │   + Config           │ │
│  └──────────┘ └──────────────┘ └──────────────────────┘ │
└──────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────┐
│                    Mobile App (React Native)               │
│  Screens: Home │ Pay │ Receive │ Settle │ Vault           │
│  Services: Seed Vault │ NFC │ Storage │ Payment           │
└──────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────┐
│                    Event Indexer                            │
│  WebSocket subscription → SQLite → Settlement explorer    │
└──────────────────────────────────────────────────────────┘
```

### Program Accounts

| Account | PDA Seeds | Purpose |
|---|---|---|
| **Vault** | `[b"vault", owner, token_mint]` | Holds deposited funds, tracks nonces and reserve ratio |
| **SettlementRecord** | `[b"settlement", vault, nonce]` | Prevents replay, provides on-chain receipts |
| **ReputationAccount** | `[b"reputation", sgt_mint]` | Tracks lifetime settlement success/failure per device |

### Instructions

| Instruction | CU | Description |
|---|---|---|
| `create_vault` | 58,474 | Create vault with SGT verification, reserve ratio, cooldown |
| `deposit` | 20,417 | SPL token transfer into vault |
| `settle_iou` | 57,966 | Ed25519 verify + transfer (or bond slash on failure) |
| `deactivate_vault` | 4,526 | Start cooldown, block new settlements |
| `reactivate_vault` | 4,331 | Cancel deactivation |
| `withdraw` | ~20,000 | Transfer remaining balance after cooldown |
| `set_reserve_ratio` | 4,379 | Update bond percentage (0-100%) |
| `set_cooldown` | 4,387 | Update cooldown period (min 5 min) |

### IOU Message Format

217-byte Borsh-serialized struct: version (1) + vault (32) + sender (32) + recipient (32) + token_mint (32) + amount (8) + nonce (8) + expiry (8) + sgt_mint (32) + memo (32). With 64-byte Ed25519 signature: **281 bytes total NFC payload**.

## Quick Start

### Install the SDK

```bash
bun add seeker-iou
# or
npm install seeker-iou
```

### Create and Sign an IOU

```typescript
import { createIOUMessage, encodeNFCPayload } from "seeker-iou";

const iouBytes = createIOUMessage({
  vault: vaultPda,
  sender: walletPublicKey,
  recipient: recipientPublicKey,
  tokenMint: usdcMint,
  amount: 5_000_000n, // 5 USDC (6 decimals)
  nonce: nextNonce,
  sgtMint: mySgtMint,
  memo: "coffee x2",
});

// Sign with Seed Vault (hardware-level)
const signature = await seedVault.signMessage(iouBytes);

// Encode for NFC transfer
const nfcPayload = encodeNFCPayload({ message: iouBytes, signature });
```

### Settle Received IOUs

```typescript
import { createSettleIOUInstruction, parseIOUMessage } from "seeker-iou";

const iou = parseIOUMessage(receivedMessage);

const [ed25519Ix, settleIx] = await createSettleIOUInstruction({
  settler: myWallet,
  vault: iou.vault,
  recipient: iou.recipient,
  tokenMint: iou.tokenMint,
  iouMessage: receivedMessage,
  signature: receivedSignature,
  nonce: iou.nonce,
  sgtMint: iou.sgtMint,
  senderPublicKey: iou.sender,
});

const tx = new Transaction().add(ed25519Ix).add(settleIx);
await sendAndConfirmTransaction(connection, tx, [myKeypair]);
```

### Verify Seeker + Check Reputation

```typescript
import { verifySeekerForVault, getReputation, calculateTrustScore } from "seeker-iou";

// Verify SGT ownership before vault creation
const sgtMint = await verifySeekerForVault(connection, walletAddress);

// Check sender reputation
const rep = await getReputation(connection, senderSgtMint);
if (rep) {
  const score = calculateTrustScore(rep); // 0.0 to 1.0
}
```

## Development Setup

### Prerequisites

- Rust 1.75+
- Solana CLI 2.0+
- Anchor CLI 0.31+
- Bun 1.0+

### Build

```bash
bun install
anchor build       # Solana program
bunx turbo build   # TypeScript SDK
```

### Test

```bash
anchor test        # 28 integration tests (happy paths + attack vectors + benchmarks)
bunx turbo test    # 34 SDK unit tests
```

### Run the Indexer

```bash
cd packages/indexer
bun install
RPC_URL=https://api.devnet.solana.com bun run dev
```

### Project Structure

```
seeker-iou/
├── programs/seeker-iou/src/       # Anchor program (8 instructions)
│   ├── instructions/              # create_vault, deposit, settle_iou, etc.
│   ├── state/                     # Vault, SettlementRecord, ReputationAccount
│   ├── iou/                       # IOUMessage Borsh struct
│   ├── errors.rs
│   └── events.rs
├── packages/sdk/                  # TypeScript SDK (npm: seeker-iou)
│   ├── src/                       # 12 modules
│   └── tests/                     # 34 unit tests
├── packages/indexer/              # Event indexer (SQLite + WebSocket)
│   └── src/
├── app/                           # React Native mobile app for Seeker
│   └── src/
│       ├── screens/               # Home, Pay, Receive, Settle
│       ├── services/              # wallet, nfc, payment, vault, storage
│       └── hooks/                 # useVault, useReputation
├── tests/                         # Anchor integration tests + benchmarks
├── formal_verification/           # Lean 4 mathematical proofs
│   ├── SPEC.md                    # Formal specification (13 properties)
│   ├── Proofs/                    # Machine-checked proofs
│   │   ├── Authorization.lean     # Owner-only operations
│   │   ├── Conservation.lean      # deposited >= spent invariant
│   │   ├── ReplayPrevention.lean  # Nonce ordering + inactive vault
│   │   ├── BondSlashing.lean      # Slash bounds + reputation
│   │   └── Cooldown.lean          # Withdrawal timing enforcement
│   └── QEDGen/                    # Solana axiom library
├── docs/
│   ├── PRD.md                     # Product Requirements Document
│   ├── HOWITWORKS.md              # Detailed flow walkthrough
│   ├── SECURITY_AUDIT.md          # Self-audit findings
│   └── AUDIT_REPORT.md            # Formal audit report for external auditors
├── .github/workflows/ci.yml      # GitHub Actions CI
├── Anchor.toml
├── turbo.json
└── package.json
```

## Formal Verification

Core program properties are **mathematically proven correct** using [Lean 4](https://lean-lang.org/) + [Mathlib](https://leanprover-community.github.io/mathlib4_docs/) via [QEDGen](https://github.com/qedgen/solana-skills).

| Category | Properties | Status |
|---|---|---|
| **Authorization** | Owner-only withdraw, deactivate; config requires active vault | Verified |
| **Conservation** | `deposited >= spent` preserved across deposit, settle, withdraw | Verified |
| **Replay Prevention** | Nonce strictly increases; inactive vault blocks settlement | Verified |
| **Bond Slashing** | Slash bounded by `min(bond, amount)`; failure updates reputation | Verified |
| **Cooldown** | Withdrawal enforces `timestamp >= deactivated_at + cooldown` | Verified |
| **PDA Uniqueness** | One settlement record per nonce | Axiomatic (Solana runtime) |
| **Arithmetic Safety** | No u64 overflow | Partial (Rust `checked_add`/`checked_sub`) |

**12/13 properties formally verified. 0 `sorry` markers. 14 theorems across 5 proof files.**

Verify yourself:

```bash
cd formal_verification && lake build
# → Build completed successfully.
```

- [Formal specification](formal_verification/SPEC.md) — 13 properties with preconditions, effects, postconditions
- [Proofs](formal_verification/Proofs/) — Machine-checked Lean 4 theorems

## Security

A comprehensive self-audit has been completed covering all 8 instructions, 3 account types, and 11 source files.

| Severity | Count | Status |
|---|---|---|
| Critical | 0 | - |
| High | 0 | - |
| Medium | 5 | 3 fixed, 1 mitigated, 1 by design |
| Low | 10 | 1 fixed, 7 mitigated, 2 by design |
| Info | 4 | By design |

**Key fixes applied:**
- Ed25519 instruction_index validation (prevents cross-instruction injection)
- Config changes blocked after vault deactivation (prevents cooldown bypass)
- Withdraw uses actual token balance as safety bound

**Reports:**
- [Self-audit summary](docs/SECURITY_AUDIT.md)
- [Formal audit report for external auditors](docs/AUDIT_REPORT.md)

> This software has not been externally audited. Do not use in production with real funds until a professional security audit is completed.

If you discover a vulnerability, report it privately via [GitHub Security Advisories](https://github.com/saicharanpogul/seeker-iou/security/advisories).

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Ensure `anchor build` and `bunx turbo build` pass
5. Ensure `anchor test` and `bunx turbo test` pass
6. Submit a PR

### Open Contributions

Looking for contributors on these items:

| Area | Description | Difficulty |
|---|---|---|
| **Settlement Explorer UI** | Web frontend for browsing settlement history, vault states, and reputation scores from the indexer's SQLite data. React/Next.js preferred. | Medium |
| **Multi-token support in app** | Vault switching between SKR, USDC, and SOL in the mobile app. UI for creating/managing multiple vaults per token mint. | Medium |
| **NFC end-to-end testing** | Validate the full tap-to-pay flow between two Seeker devices. Document edge cases and failure modes. | Requires 2 Seekers |
| **Push notifications** | Alert users when their issued IOUs get settled or fail. FCM integration in the mobile app. | Medium |

### Quasar Zero-Copy Port

A port of the entire program to the [Quasar](https://quasar-lang.com) zero-copy framework is in progress on the [`feat/quasar`](https://github.com/saicharanpogul/seeker-iou/tree/feat/quasar) branch.

| Metric | Anchor | Quasar |
|---|---|---|
| Binary size | 397 KB | 43 KB (9.5x smaller) |
| Heap allocations | Yes (Borsh deser) | Zero (pointer-cast) |
| `no_std` | No | Yes |

All 8 instructions compile and the IDL + Rust client are auto-generated. Quasar is currently in beta ([not yet audited](https://github.com/blueshift-gg/quasar)), so this branch is experimental. Contributions to complete the QuasarSVM integration tests are welcome — the `quasar-svm` dev dependency is temporarily disabled due to a transitive `toml_parser` edition2024 incompatibility with the Solana toolchain.

## License

MIT
