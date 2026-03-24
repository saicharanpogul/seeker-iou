/**
 * Dev mode — toggled via the Connect screen before connecting.
 *
 * OFF (default): Real Seed Vault, NFC hardware, on-chain transactions.
 * ON: Mocks wallet, NFC, settlement, storage for simulator testing.
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
