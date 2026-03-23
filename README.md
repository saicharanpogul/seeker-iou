# seeker-iou

**Offline payment infrastructure for Solana Seeker. Vault-based IOUs exchanged over NFC. Settles on-chain when connectivity returns.**

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

## Why Seeker

This can only exist on Seeker. Every component depends on hardware no other phone has.

**Seed Vault** signs IOUs at the hardware level. Even if the app is compromised, the signatures are tamper-proof. In Iran right now, cyberattacks are running alongside kinetic strikes. CrowdStrike confirmed Iranian-aligned threat actors are already conducting reconnaissance and launching attacks ([CNBC](https://www.cnbc.com/2026/03/02/irans-internet-down-amid-reports-of-us-israel-cyberattacks.html)). When cyber and physical warfare happen simultaneously, hardware-signed promises are the only kind you can trust.

**SGT (Seeker Genesis Token)** ties every participant to a unique physical device. One person, one identity, one reputation. If someone writes IOUs they can't cover, that failure follows their device forever. No new accounts. No fresh starts.

**NFC** makes the transfer physical. Two phones touch. Fingerprint confirms. Two seconds. No QR codes to scan, no addresses to type, no wallet apps to connect.

**.skr domains** make it human. You see "mango-vendor.skr" not "7xK9m...3fP2".

## Anti-cheat

Offline payments have a fundamental trust problem: without network state, you can't verify someone's balance in real time. seeker-iou solves this through six layers of accountability:

1. **Vault balance visibility**: recipient sees the sender's deposited amount (cached from last sync) before accepting.
2. **SGT-linked reputation**: every settlement (success or failure) updates a permanent reputation score tied to the sender's device.
3. **Nonce ordering**: sequential IOUs prevent replay and double-spend. First to settle wins.
4. **Deactivation cooldown**: vault owners can't instantly drain funds after issuing IOUs. A cooldown window lets pending IOUs settle first.
5. **Failed settlements still record**: even if an IOU fails due to insufficient funds, it hits the sender's reputation. Cheating is always visible.
6. **Configurable risk tiers**: apps set their own thresholds. Auto-accept under 10 SKR. Show trust score for larger amounts. Refuse offline above a ceiling.

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
│  reactivate_vault                                         │
└───────────────────────────────┬──────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────┐
│                    TypeScript SDK                          │
│  ┌─────┐ ┌─────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ IOU │ │ NFC │ │Settlement│ │Reputation│ │  Local  │ │
│  │     │ │     │ │ Builder  │ │  Query   │ │  State  │ │
│  └─────┘ └─────┘ └──────────┘ └──────────┘ └─────────┘ │
└──────────────────────────────────────────────────────────┘
```

### Program Accounts

- **Vault** — One per user per token mint. PDA: `[b"vault", owner, token_mint]`. Holds deposited funds and tracks nonces.
- **SettlementRecord** — One per settled IOU. PDA: `[b"settlement", vault, nonce]`. Prevents replay and provides receipts.
- **ReputationAccount** — One per SGT. PDA: `[b"reputation", sgt_mint]`. Tracks lifetime settlement success/failure.

### IOU Message Format

217-byte Borsh-serialized struct: version (1) + vault (32) + sender (32) + recipient (32) + token_mint (32) + amount (8) + nonce (8) + expiry (8) + sgt_mint (32) + memo (32). With 64-byte Ed25519 signature: 281 bytes total NFC payload.

## Quick Start

### SDK Installation

```bash
bun add seeker-iou
```

### Create and Sign an IOU

```typescript
import { createIOUMessage, encodeNFCPayload, deriveVaultPda } from "seeker-iou";

// Create IOU message
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
// → Send nfcPayload over NFC
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

### Check Reputation

```typescript
import { getReputation, calculateTrustScore } from "seeker-iou";

const rep = await getReputation(connection, senderSgtMint);
if (rep) {
  const score = calculateTrustScore(rep);
  console.log(`Trust score: ${score}`); // 0.0 to 1.0
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
# Install dependencies
bun install

# Build the Solana program
anchor build

# Build the SDK
bunx turbo build
```

### Test

```bash
# Run Anchor integration tests (starts local validator)
anchor test

# Run SDK unit tests
bunx turbo test
```

### Project Structure

```
seeker-iou/
├── programs/seeker-iou/src/
│   ├── lib.rs
│   ├── instructions/        # create_vault, deposit, settle_iou, etc.
│   ├── state/               # Vault, SettlementRecord, ReputationAccount
│   ├── iou/                 # IOUMessage Borsh struct
│   ├── errors.rs
│   └── events.rs
├── packages/sdk/src/
│   ├── iou.ts               # IOU creation + serialization
│   ├── nfc.ts               # NFC payload encoding
│   ├── vault.ts             # Vault instruction builders
│   ├── settlement.ts        # Settlement instruction builders
│   ├── reputation.ts        # Reputation queries
│   ├── local-state.ts       # Offline state management
│   ├── verification.ts      # Client-side sig verification
│   ├── types.ts, constants.ts, errors.ts, utils.ts
│   └── index.ts
├── tests/                   # Anchor integration tests
├── Anchor.toml
├── turbo.json
└── package.json
```

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Ensure `anchor build` and `bunx turbo build` pass
5. Ensure `anchor test` and `bunx turbo test` pass
6. Submit a PR

## Security

This software is in active development and has not been audited. Do not use in production with real funds until a security audit has been completed.

If you discover a security vulnerability, please report it privately via GitHub Security Advisories rather than opening a public issue.

## License

MIT
