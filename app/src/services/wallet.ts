import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { isDevMode, mockDelay } from "./devMode";

const RPC_URL = "https://api.devnet.solana.com";

export const connection = new Connection(RPC_URL, "confirmed");

let cachedPublicKey: PublicKey | null = null;
let cachedAuthToken: string | null = null;

// Dev mode keypair
let devKeypair: Keypair | null = null;
function getDevKeypair(): Keypair {
  if (!devKeypair) {
    devKeypair = Keypair.generate();
    console.log("[DEV] Mock wallet:", devKeypair.publicKey.toBase58());
  }
  return devKeypair;
}

// Lazy-loaded MWA transact function (only loaded on real device)
let _transact: any = null;
async function getTransact() {
  if (_transact) return _transact;
  try {
    const mod = require("@solana-mobile/mobile-wallet-adapter-protocol-web3js");
    _transact = mod.transact;
    return _transact;
  } catch (err) {
    throw new Error(
      "Solana Mobile Wallet Adapter not available. " +
      "Run 'npx expo run:android' for a dev build, or enable Dev Mode."
    );
  }
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

  const transact = await getTransact();
  let authToken: string | null = null;
  const result = await transact(async (wallet: any) => {
    const auth = await wallet.authorize({
      cluster: "devnet",
      identity: {
        name: "seeker-iou",
        uri: "https://github.com/saicharanpogul/seeker-iou",
        icon: "favicon.ico",
      },
    });
    authToken = auth.auth_token;
    return auth;
  });

  // MWA returns address as base64-encoded string (not base58)
  const addr = result.accounts[0].address;
  const bytes = typeof addr === "string"
    ? Buffer.from(addr, "base64")
    : Buffer.from(addr);
  cachedPublicKey = new PublicKey(bytes);
  cachedAuthToken = authToken;
  return cachedPublicKey;
}

/**
 * Sign a raw message (Ed25519).
 * DEV: signs with the generated keypair.
 * PROD: routes through Seed Vault hardware signing.
 */
export async function signMessage(message: Uint8Array): Promise<Uint8Array> {
  if (isDevMode()) {
    await mockDelay(400);
    const kp = getDevKeypair();
    const signature = nacl.sign.detached(message, kp.secretKey);
    return signature;
  }

  if (!cachedPublicKey || !cachedAuthToken) throw new Error("Wallet not connected.");
  const transact = await getTransact();
  const signatures = await transact(async (wallet: any) => {
    await wallet.reauthorize({ auth_token: cachedAuthToken });
    return wallet.signMessages({
      addresses: [cachedPublicKey!.toBytes()],
      payloads: [message],
    });
  });
  return signatures[0];
}

/**
 * Sign and send a transaction.
 * DEV: returns a fake signature.
 * PROD: Mobile Wallet Adapter → sign → submit → confirm.
 */
export async function signAndSendTransaction(
  transaction: Transaction
): Promise<string> {
  if (isDevMode()) {
    await mockDelay(1200);
    const fakeSig = Buffer.from(nacl.randomBytes(64)).toString("base64").slice(0, 88);
    console.log("[DEV] Transaction 'sent':", fakeSig.slice(0, 16) + "...");
    return fakeSig;
  }

  if (!cachedPublicKey || !cachedAuthToken) throw new Error("Wallet not connected.");
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = cachedPublicKey;

  const transact = await getTransact();
  const signatures = await transact(async (wallet: any) => {
    await wallet.reauthorize({ auth_token: cachedAuthToken });
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
  cachedAuthToken = null;
  devKeypair = null;
}
