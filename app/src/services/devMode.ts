/**
 * Dev mode — manually toggled via the Settings screen.
 * When ON: mocks wallet, NFC, settlement, storage.
 * When OFF: uses real Seed Vault, NFC hardware, on-chain transactions.
 *
 * Default: OFF. Toggle from Settings screen.
 */

let _devMode = false;

export function isDevMode(): boolean {
  return _devMode;
}

export function setDevMode(on: boolean): void {
  _devMode = on;
  console.log(`[DEV MODE] ${on ? "ENABLED" : "DISABLED"}`);
}

export const MOCK_DELAY = 800;

export function mockDelay(ms: number = MOCK_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
