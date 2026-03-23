import { Connection, PublicKey } from "@solana/web3.js";
import Database from "better-sqlite3";
import {
  createDb,
  getLastProcessedSlot,
  setLastProcessedSlot,
} from "./db";
import {
  parseTransactionLogs,
  PROGRAM_ID,
  type SettlementEvent,
  type VaultEvent,
  type ParsedEvent,
} from "./parser";

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL || "5000");

function isSettlementEvent(e: ParsedEvent): e is SettlementEvent {
  return e.type === "IOUSettled" || e.type === "IOUFailed";
}

class Indexer {
  private connection: Connection;
  private db: Database.Database;
  private insertSettlement: Database.Statement;
  private insertVaultEvent: Database.Statement;

  constructor() {
    this.connection = new Connection(RPC_URL, "confirmed");
    this.db = createDb();

    this.insertSettlement = this.db.prepare(`
      INSERT OR IGNORE INTO settlements
        (signature, vault, recipient, amount, nonce, settler, success, slash_amount, slot, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    this.insertVaultEvent = this.db.prepare(`
      INSERT INTO vault_events
        (signature, event_type, vault, owner, amount, data, slot, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  async start(): Promise<void> {
    console.log(`seeker-iou indexer starting`);
    console.log(`RPC: ${RPC_URL}`);
    console.log(`Program: ${PROGRAM_ID.toBase58()}`);
    console.log(`Poll interval: ${POLL_INTERVAL_MS}ms`);

    const lastSlot = getLastProcessedSlot(this.db);
    console.log(`Resuming from slot ${lastSlot}`);

    // Subscribe to program logs in real-time
    this.connection.onLogs(
      PROGRAM_ID,
      (logInfo) => {
        this.processLogInfo(logInfo);
      },
      "confirmed"
    );

    console.log("Listening for program events...");

    // Also backfill by polling signatures
    await this.backfill(lastSlot);

    // Keep alive
    setInterval(() => {
      const count = this.db
        .prepare("SELECT COUNT(*) as c FROM settlements")
        .get() as { c: number };
      console.log(`[heartbeat] ${count.c} settlements indexed`);
    }, 60000);
  }

  private async backfill(fromSlot: number): Promise<void> {
    console.log(`Backfilling from slot ${fromSlot}...`);

    let before: string | undefined;
    let totalProcessed = 0;

    while (true) {
      const signatures = await this.connection.getSignaturesForAddress(
        PROGRAM_ID,
        { before, limit: 100 },
        "confirmed"
      );

      if (signatures.length === 0) break;

      for (const sigInfo of signatures) {
        if (sigInfo.slot <= fromSlot) {
          console.log(`Backfill complete. Processed ${totalProcessed} transactions.`);
          return;
        }

        await this.processTransaction(sigInfo.signature, sigInfo.slot);
        totalProcessed++;
      }

      before = signatures[signatures.length - 1].signature;

      // Rate limiting
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log(`Backfill complete. Processed ${totalProcessed} transactions.`);
  }

  private async processTransaction(
    signature: string,
    slot: number
  ): Promise<void> {
    try {
      const tx = await this.connection.getTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!tx?.meta?.logMessages) return;

      const events = parseTransactionLogs(tx.meta.logMessages);
      const timestamp = new Date(
        (tx.blockTime || 0) * 1000
      ).toISOString();

      this.storeEvents(events, signature, slot, timestamp);

      setLastProcessedSlot(this.db, slot);
    } catch (err) {
      console.error(`Error processing tx ${signature}:`, err);
    }
  }

  private processLogInfo(logInfo: {
    signature: string;
    logs: string[];
    err: any;
  }): void {
    if (logInfo.err) return;

    const events = parseTransactionLogs(logInfo.logs);
    const timestamp = new Date().toISOString();

    this.storeEvents(events, logInfo.signature, 0, timestamp);
  }

  private storeEvents(
    events: ParsedEvent[],
    signature: string,
    slot: number,
    timestamp: string
  ): void {
    for (const event of events) {
      if (isSettlementEvent(event)) {
        this.insertSettlement.run(
          signature,
          event.vault,
          event.recipient,
          Number(event.amount),
          Number(event.nonce),
          event.settler,
          event.type === "IOUSettled" ? 1 : 0,
          Number(event.slashAmount || 0),
          slot,
          timestamp
        );

        const status = event.type === "IOUSettled" ? "SUCCESS" : "FAILED";
        const slash =
          event.type === "IOUFailed" && event.slashAmount
            ? ` (slashed ${event.slashAmount})`
            : "";
        console.log(
          `[${status}] nonce=${event.nonce} amount=${event.amount} vault=${event.vault.slice(0, 8)}...${slash}`
        );
      } else {
        const vaultEvent = event as VaultEvent;
        this.insertVaultEvent.run(
          signature,
          vaultEvent.type,
          vaultEvent.vault,
          vaultEvent.owner || null,
          vaultEvent.amount ? Number(vaultEvent.amount) : null,
          vaultEvent.data ? JSON.stringify(vaultEvent.data) : null,
          slot,
          timestamp
        );

        console.log(
          `[EVENT] ${vaultEvent.type} vault=${vaultEvent.vault.slice(0, 8)}...`
        );
      }
    }
  }
}

const indexer = new Indexer();
indexer.start().catch(console.error);
