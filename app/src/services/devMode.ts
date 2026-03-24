/**
 * Dev mode configuration.
 * When enabled, mocks wallet (Seed Vault), NFC, and on-chain operations
 * so the full payment flow works in a simulator without hardware.
 */

export const DEV_MODE = __DEV__ ?? true;

// Simulated delay for mock operations (ms)
export const MOCK_DELAY = 800;

export function mockDelay(ms: number = MOCK_DELAY): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
