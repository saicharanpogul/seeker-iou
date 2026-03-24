import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

const RPC_URL = "https://api.devnet.solana.com";
const APP_IDENTITY = {
  name: "seeker-iou",
  uri: "https://github.com/saicharanpogul/seeker-iou",
  icon: "favicon.ico",
};

export const connection = new Connection(RPC_URL, "confirmed");

let cachedAuthToken: string | null = null;
let cachedPublicKey: PublicKey | null = null;

export function getPublicKey(): PublicKey | null {
  return cachedPublicKey;
}

/**
 * Connect to wallet via Solana Mobile Wallet Adapter.
 * On Seeker, this routes through the Seed Vault which handles
 * biometric authentication and key management.
 */
export async function connectWallet(): Promise<PublicKey> {
  const result = await transact(async (wallet: Web3MobileWallet) => {
    const auth = await wallet.authorize({
      cluster: "devnet",
      identity: APP_IDENTITY,
    });
    return auth;
  });

  cachedAuthToken = result.auth_token;
  cachedPublicKey = new PublicKey(result.accounts[0].address);
  return cachedPublicKey;
}

/**
 * Reauthorize using cached token (avoids repeated biometric prompts).
 */
export async function reauthorize(): Promise<PublicKey> {
  if (!cachedAuthToken) {
    return connectWallet();
  }

  const result = await transact(async (wallet: Web3MobileWallet) => {
    const auth = await wallet.reauthorize({
      auth_token: cachedAuthToken!,
      identity: APP_IDENTITY,
    });
    return auth;
  });

  cachedAuthToken = result.auth_token;
  cachedPublicKey = new PublicKey(result.accounts[0].address);
  return cachedPublicKey;
}

/**
 * Sign a raw message using the Seed Vault (hardware Ed25519).
 * This is the critical path for IOU signing — the private key
 * never leaves the secure enclave.
 */
export async function signMessage(message: Uint8Array): Promise<Uint8Array> {
  if (!cachedAuthToken) {
    throw new Error("Wallet not connected. Call connectWallet() first.");
  }

  const signatures = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.reauthorize({
      auth_token: cachedAuthToken!,
      identity: APP_IDENTITY,
    });

    const signed = await wallet.signMessages({
      addresses: [cachedPublicKey!.toBase58()],
      payloads: [message],
    });
    return signed;
  });

  return signatures[0];
}

/**
 * Sign and send a transaction via Mobile Wallet Adapter.
 * The wallet handles signing (via Seed Vault) and submission.
 */
export async function signAndSendTransaction(
  transaction: Transaction
): Promise<string> {
  if (!cachedAuthToken) {
    throw new Error("Wallet not connected. Call connectWallet() first.");
  }

  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = cachedPublicKey!;

  const signatures = await transact(async (wallet: Web3MobileWallet) => {
    await wallet.reauthorize({
      auth_token: cachedAuthToken!,
      identity: APP_IDENTITY,
    });

    const signed = await wallet.signAndSendTransactions({
      transactions: [transaction],
    });
    return signed;
  });

  // Confirm the transaction
  const sig = signatures[0];
  await connection.confirmTransaction({
    signature: sig,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });

  return sig;
}

/**
 * Disconnect and clear cached auth.
 */
export function disconnect(): void {
  cachedAuthToken = null;
  cachedPublicKey = null;
}
