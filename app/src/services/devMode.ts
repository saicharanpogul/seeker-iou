/**
 * Dev mode — auto-detected or manually toggled via Settings.
 *
 * Auto-detection: If Solana Mobile native modules aren't available
 * (Expo Go / simulator), dev mode turns ON automatically.
 * On a real Seeker device with a dev build, it stays OFF.
 *
 * When ON: mocks wallet, NFC, settlement, storage.
 * When OFF: uses real Seed Vault, NFC hardware, on-chain transactions.
 */

import { TurboModuleRegistry } from "react-native";

// Auto-detect: check if the Solana Mobile native module exists
function detectDevMode(): boolean {
  try {
    // If this native module isn't registered, we're in Expo Go
    const hasNativeWallet = TurboModuleRegistry.get("SolanaMobileWalletAdapter");
    return !hasNativeWallet;
  } catch {
    return true; // Native module check failed — assume Expo Go
  }
}

let _devMode = detectDevMode();
let _userOverride = false;

export function isDevMode(): boolean {
  return _devMode;
}

/**
 * Manually toggle dev mode.
 * Only allows turning OFF if native modules are actually available.
 */
export function setDevMode(on: boolean): void {
  _userOverride = true;
  _devMode = on;
  console.log(`[DEV MODE] ${on ? "ENABLED (manual)" : "DISABLED (manual)"}`);
}

/**
 * Whether dev mode was auto-detected (vs manually toggled).
 */
export function isAutoDetected(): boolean {
  return !_userOverride;
}

export const MOCK_DELAY = 800;

export function mockDelay(ms: number = MOCK_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
