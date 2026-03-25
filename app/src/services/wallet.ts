import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import { isDevMode, mockDelay } from "./devMode";

const RPC_URL = "https://api.devnet.solana.com";

export const connection = new Connection(RPC_URL, "confirmed");

let cachedPublicKey: PublicKey | null = null;
let cachedAuthToken: string | null = null;
let cachedBase64Address: string | null = null; // MWA base64 format, kept for sign calls

// Dev mode keypair
let devKeypair: Keypair | null = null;
function getDevKeypair(): Keypair {
  if (!devKeypair) devKeypair = Keypair.generate();
  return devKeypair;
}

// Lazy-loaded MWA transact (only on real device)
let _transact: any = null;
function getTransact(): any {
  if (_transact) return _transact;
  try {
    const mod = require("@solana-mobile/mobile-wallet-adapter-protocol-web3js");
    _transact = mod.transact;
    return _transact;
  } catch (err) {
    throw new Error("Solana Mobile Wallet Adapter not available. Enable Dev Mode or use a dev build.");
  }
}

export function getPublicKey(): PublicKey | null {
  return cachedPublicKey;
}

export async function connectWallet(): Promise<PublicKey> {
  if (isDevMode()) {
    await mockDelay();
    const kp = getDevKeypair();
    cachedPublicKey = kp.publicKey;
    return cachedPublicKey;
  }

  const transact = getTransact();
  const result = await transact(async (wallet: any) => {
    return wallet.authorize({
      cluster: "devnet",
      identity: {
        name: "seeker-iou",
        uri: "https://github.com/saicharanpogul/seeker-iou",
        icon: "favicon.ico",
      },
    });
  });

  // MWA returns address as Base64EncodedAddress (string)
  // Keep original for sign/send calls; decode to PublicKey for display
  cachedBase64Address = result.accounts[0].address;
  cachedAuthToken = result.auth_token;
  cachedPublicKey = new PublicKey(Buffer.from(cachedBase64Address, "base64"));
  return cachedPublicKey;
}

export async function signMessage(message: Uint8Array): Promise<Uint8Array> {
  if (isDevMode()) {
    await mockDelay(400);
    return nacl.sign.detached(message, getDevKeypair().secretKey);
  }

  if (!cachedBase64Address || !cachedAuthToken) throw new Error("Wallet not connected.");
  const transact = getTransact();
  const result = await transact(async (wallet: any) => {
    await wallet.reauthorize({ auth_token: cachedAuthToken });
    return wallet.signMessages({
      addresses: [cachedBase64Address],
      payloads: [Buffer.from(message).toString("base64")],
    });
  });
  // Result is base64-encoded signatures
  return new Uint8Array(Buffer.from(result[0], "base64"));
}

export async function signAndSendTransaction(
  transaction: Transaction
): Promise<string> {
  if (isDevMode()) {
    await mockDelay(1200);
    return Buffer.from(nacl.randomBytes(64)).toString("base64").slice(0, 88);
  }

  if (!cachedPublicKey || !cachedAuthToken) throw new Error("Wallet not connected.");
  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = cachedPublicKey;

  const transact = getTransact();
  const signatures = await transact(async (wallet: any) => {
    await wallet.reauthorize({ auth_token: cachedAuthToken });
    return wallet.signAndSendTransactions({
      transactions: [
        Buffer.from(
          transaction.serialize({ requireAllSignatures: false })
        ).toString("base64"),
      ],
    });
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
  cachedBase64Address = null;
  devKeypair = null;
}
