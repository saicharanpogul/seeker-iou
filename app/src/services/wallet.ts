import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";

const RPC_URL = "https://api.devnet.solana.com";

export const connection = new Connection(RPC_URL, "confirmed");

export interface WalletState {
  publicKey: PublicKey | null;
  connected: boolean;
}

/**
 * Connect to wallet via Solana Mobile Wallet Adapter.
 * On Seeker, this routes through the Seed Vault.
 */
export async function connectWallet(): Promise<PublicKey> {
  // In production, use @solana-mobile/mobile-wallet-adapter-protocol
  // const { transact } = await import(
  //   "@solana-mobile/mobile-wallet-adapter-protocol-web3js"
  // );
  // const authResult = await transact(async (wallet) => {
  //   return await wallet.authorize({
  //     cluster: "devnet",
  //     identity: { name: "seeker-iou" },
  //   });
  // });
  // return new PublicKey(authResult.accounts[0].address);

  // Placeholder for development
  throw new Error("Connect via Solana Mobile Wallet Adapter on Seeker device");
}

/**
 * Sign a message using the Seed Vault (hardware Ed25519).
 * This is the critical path for IOU signing.
 */
export async function signMessage(message: Uint8Array): Promise<Uint8Array> {
  // In production, use @solana-mobile/seed-vault-lib
  // const { SeedVaultWallet } = await import("@solana-mobile/seed-vault-lib");
  // const seedVault = SeedVaultWallet.getInstance();
  // return seedVault.signMessage(message);

  throw new Error("Sign via Seed Vault on Seeker device");
}

/**
 * Sign and send a transaction via Mobile Wallet Adapter.
 */
export async function signAndSendTransaction(
  transaction: Transaction
): Promise<string> {
  // In production:
  // const { transact } = await import(
  //   "@solana-mobile/mobile-wallet-adapter-protocol-web3js"
  // );
  // return transact(async (wallet) => {
  //   const { signatures } = await wallet.signAndSendTransactions({
  //     transactions: [transaction],
  //     connection,
  //   });
  //   return signatures[0];
  // });

  throw new Error("Sign via Mobile Wallet Adapter on Seeker device");
}
