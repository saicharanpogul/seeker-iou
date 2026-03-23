# seeker-iou Mobile App

React Native app for Seeker devices. Consumes the `seeker-iou` SDK for offline NFC payments.

## Screens

- **Home** — Balance display, Pay/Receive buttons, Vault management
- **Pay** — Enter amount + memo, tap to send IOU via NFC
- **Receive** — Listen for incoming NFC taps, display sender .skr domain + trust score
- **Settle** — Submit collected IOUs when back online

## Services

- `wallet.ts` — Solana Mobile Wallet Adapter + Seed Vault signing
- `nfc.ts` — NFC send/receive via react-native-nfc-manager
- `payment.ts` — IOU creation, signing, NFC transfer, settlement
- `vault.ts` — Vault CRUD operations (create, deposit, deactivate, withdraw)
- `storage.ts` — MMKV-based local persistence for offline state

## Hooks

- `useVault` — Vault state management with on-chain sync
- `useReputation` — Trust score fetching and display

## Requirements

- Solana Seeker device (for Seed Vault + NFC hardware)
- Expo SDK 52+
- React Native 0.76+

## Development

```bash
cd app
bun install
bun run start
```

Scan QR code with Expo Go, or run on device with `bun run android`.
