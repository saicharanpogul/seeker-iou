import { PublicKey, Transaction } from "@solana/web3.js";
import {
  createIOUMessage,
  parseIOUMessage,
  trackIssuedIOU,
  getLocalAvailableBalance,
  createSettleIOUInstruction,
  formatAmount,
  type LocalVaultState,
  type PendingIOU,
  type ReceivedIOU,
} from "seeker-iou";
import { connection, signMessage, signAndSendTransaction, getPublicKey } from "./wallet";
import { sendIOUViaNFC, receiveIOUViaNFC } from "./nfc";
import { isDevMode, mockDelay } from "./devMode";
import {
  saveVaultState,
  loadVaultState,
  addReceivedIOU,
  loadReceivedIOUs,
  markIOUSettled,
  loadSgtMint,
  loadTokenMint,
} from "./storage";

/**
 * Create, sign, and send an IOU payment via NFC tap.
 * This is the main offline payment flow.
 */
export async function sendPayment(params: {
  recipient: PublicKey;
  amount: bigint;
  memo?: string;
}): Promise<{ updatedState: LocalVaultState; iou: PendingIOU }> {
  const localState = loadVaultState();
  if (!localState) throw new Error("No vault state. Create a vault first.");

  const sgtMintStr = loadSgtMint();
  const tokenMintStr = loadTokenMint();
  if (!sgtMintStr || !tokenMintStr) throw new Error("Missing config. Set up vault first.");

  const wallet = getPublicKey();
  if (!wallet) throw new Error("Wallet not connected.");

  const vault = new PublicKey(localState.vaultAddress);
  const sgtMint = new PublicKey(sgtMintStr);
  const tokenMint = new PublicKey(tokenMintStr);

  // Check local balance
  const available = getLocalAvailableBalance(localState);
  if (available < params.amount) {
    throw new Error(
      `Insufficient balance: ${formatAmount(available, 6)} available, ${formatAmount(params.amount, 6)} requested`
    );
  }

  const nextNonce = localState.currentNonce + 1;

  // Create IOU message (217 bytes)
  const message = createIOUMessage({
    vault,
    sender: wallet,
    recipient: params.recipient,
    tokenMint,
    amount: params.amount,
    nonce: nextNonce,
    sgtMint,
    memo: params.memo,
  });

  // Sign with Seed Vault (hardware Ed25519 — key never leaves secure enclave)
  const signature = await signMessage(message);

  // Send via NFC tap
  const result = await sendIOUViaNFC(message, signature);
  if (!result.success) {
    throw new Error(`NFC send failed: ${result.error}`);
  }

  // Track locally
  const iou: PendingIOU = {
    recipient: params.recipient.toBase58(),
    amount: params.amount,
    nonce: nextNonce,
    message,
    signature,
    createdAt: Date.now(),
    settled: false,
  };

  const updatedState = trackIssuedIOU(localState, iou);
  saveVaultState(updatedState);

  return { updatedState, iou };
}

/**
 * Receive an IOU payment via NFC tap.
 * Blocks until a valid NFC tag is detected.
 */
export async function receivePayment(): Promise<{
  iou: ReceivedIOU;
  senderDisplay: string;
} | null> {
  const result = await receiveIOUViaNFC();

  if (!result.success || !result.iou || !result.signature || !result.rawMessage) {
    return null;
  }

  // Resolve .skr domain for human-readable display
  let senderDisplay: string;
  if (isDevMode()) {
    senderDisplay = "dev-sender.skr";
  } else {
    try {
      const { resolveRecipientDisplay } = await import("seeker-iou");
      const domain = await resolveRecipientDisplay(connection, result.iou.sender);
      senderDisplay = domain || result.iou.sender.toBase58().slice(0, 8) + "...";
    } catch {
      senderDisplay = result.iou.sender.toBase58().slice(0, 8) + "...";
    }
  }

  const received: ReceivedIOU = {
    sender: result.iou.sender.toBase58(),
    senderSgtMint: result.iou.sgtMint.toBase58(),
    amount: result.iou.amount,
    nonce: result.iou.nonce,
    message: result.rawMessage,
    signature: result.signature,
    receivedAt: Date.now(),
    settled: false,
    settlementTx: null,
  };

  // Persist to local storage
  addReceivedIOU(received);

  return { iou: received, senderDisplay };
}

/**
 * Settle all pending IOUs when back online.
 * Batches into transactions (~2 IOUs per tx) and submits.
 */
export async function settleAllIOUs(): Promise<{
  settled: number;
  failed: number;
  txSignatures: string[];
}> {
  const wallet = getPublicKey();
  if (!wallet) throw new Error("Wallet not connected.");

  const receivedIOUs = loadReceivedIOUs().filter((iou) => !iou.settled);
  if (receivedIOUs.length === 0) {
    return { settled: 0, failed: 0, txSignatures: [] };
  }

  const txSignatures: string[] = [];
  let settled = 0;
  let failed = 0;

  for (const iou of receivedIOUs) {
    try {
      if (isDevMode()) {
        // Simulate settlement
        await mockDelay(800);
        const fakeSig = `dev_settle_${iou.nonce}_${Date.now()}`;
        txSignatures.push(fakeSig);
        markIOUSettled(iou.nonce, fakeSig);
        settled++;
        console.log(`[DEV] Settled IOU nonce=${iou.nonce}`);
      } else {
        const parsed = parseIOUMessage(iou.message);

        const instructions = await createSettleIOUInstruction({
          settler: wallet,
          vault: parsed.vault,
          recipient: parsed.recipient,
          tokenMint: parsed.tokenMint,
          iouMessage: iou.message,
          signature: iou.signature,
          nonce: parsed.nonce,
          sgtMint: parsed.sgtMint,
          senderPublicKey: parsed.sender,
        });

        const tx = new Transaction();
        for (const ix of instructions) {
          tx.add(ix);
        }

        const sig = await signAndSendTransaction(tx);
        txSignatures.push(sig);
        markIOUSettled(iou.nonce, sig);
        settled++;
      }
    } catch (err) {
      console.error(`Failed to settle IOU nonce=${iou.nonce}:`, err);
      failed++;
    }
  }

  return { settled, failed, txSignatures };
}

/**
 * Get count of unsettled IOUs.
 */
export function getPendingIOUCount(): number {
  return loadReceivedIOUs().filter((iou) => !iou.settled).length;
}
