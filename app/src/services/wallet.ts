import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { isDevMode, mockDelay } from "./devMode";

const RPC_URL = "https://api.devnet.solana.com";

export const connection = new Connection(RPC_URL, "confirmed");

let cachedPublicKey: PublicKey | null = null;

// Dev mode: generate a deterministic keypair for testing
let devKeypair: Keypair | null = null;
function getDevKeypair(): Keypair {
  if (!devKeypair) {
    devKeypair = Keypair.generate();
    console.log("[DEV] Mock wallet:", devKeypair.publicKey.toBase58());
  }
  return devKeypair;
}

export function getPublicKey(): PublicKey | null {
  return cachedPublicKey;
}

/**
 * Connect to wallet.
 * DEV: returns a generated keypair.
 * PROD: Solana Mobile Wallet Adapter → Seed Vault.
 */
export async function connectWallet(): Promise<PublicKey> {
  if (isDevMode()) {
    await mockDelay();
    const kp = getDevKeypair();
    cachedPublicKey = kp.publicKey;
    console.log("[DEV] Wallet connected:", cachedPublicKey.toBase58());
    return cachedPublicKey;
  }

  // Production: Solana Mobile Wallet Adapter
  const { transact } = await import(
    "@solana-mobile/mobile-wallet-adapter-protocol-web3js"
  );
  const result = await transact(async (wallet) => {
    return wallet.authorize({
      cluster: "devnet",
      identity: { name: "seeker-iou", uri: "https://github.com/saicharanpogul/seeker-iou", icon: "favicon.ico" },
    });
  });
  cachedPublicKey = new PublicKey(result.accounts[0].address);
  return cachedPublicKey;
}

/**
 * Sign a raw message (Ed25519).
 * DEV: signs with the generated keypair (mimics Seed Vault).
 * PROD: routes through Seed Vault hardware signing.
 */
export async function signMessage(message: Uint8Array): Promise<Uint8Array> {
  if (isDevMode()) {
    await mockDelay(400);
    const kp = getDevKeypair();
    const signature = nacl.sign.detached(message, kp.secretKey);
    console.log("[DEV] Message signed, sig:", Buffer.from(signature.slice(0, 8)).toString("hex") + "...");
    return signature;
  }

  if (!cachedPublicKey) throw new Error("Wallet not connected.");
  const { transact } = await import(
    "@solana-mobile/mobile-wallet-adapter-protocol-web3js"
  );
  const signatures = await transact(async (wallet) => {
    return wallet.signMessages({
      addresses: [cachedPublicKey!.toBase58()],
      payloads: [message],
    });
  });
  return signatures[0];
}

/**
 * Sign and send a transaction.
 * DEV: signs locally and logs (doesn't actually submit).
 * PROD: Mobile Wallet Adapter → sign → submit → confirm.
 */
export async function signAndSendTransaction(
  transaction: Transaction
): Promise<string> {
  if (isDevMode()) {
    await mockDelay(1200);
    // Generate a fake signature
    const fakeSig = Buffer.from(nacl.randomBytes(64)).toString("base64").slice(0, 88);
    console.log("[DEV] Transaction 'sent':", fakeSig.slice(0, 16) + "...");
    return fakeSig;
  }

  if (!cachedPublicKey) throw new Error("Wallet not connected.");
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = cachedPublicKey;

  const { transact } = await import(
    "@solana-mobile/mobile-wallet-adapter-protocol-web3js"
  );
  const signatures = await transact(async (wallet) => {
    return wallet.signAndSendTransactions({ transactions: [transaction] });
  });
  const sig = signatures[0];
  await connection.confirmTransaction({
    signature: sig,
    blockhash: latestBlockhash.blockhash,
    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
  });
  return sig;
}

export function disconnect(): void {
  cachedPublicKey = null;
  devKeypair = null;
}
