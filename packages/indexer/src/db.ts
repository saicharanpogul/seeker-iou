import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "seeker-iou.db");

export function createDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signature TEXT NOT NULL UNIQUE,
      vault TEXT NOT NULL,
      recipient TEXT NOT NULL,
      amount INTEGER NOT NULL,
      nonce INTEGER NOT NULL,
      settler TEXT NOT NULL,
      success INTEGER NOT NULL,
      slash_amount INTEGER NOT NULL DEFAULT 0,
      slot INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_settlements_vault ON settlements(vault);
    CREATE INDEX IF NOT EXISTS idx_settlements_recipient ON settlements(recipient);
    CREATE INDEX IF NOT EXISTS idx_settlements_slot ON settlements(slot);

    CREATE TABLE IF NOT EXISTS vault_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      signature TEXT NOT NULL,
      event_type TEXT NOT NULL,
      vault TEXT NOT NULL,
      owner TEXT,
      amount INTEGER,
      data TEXT,
      slot INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_vault_events_vault ON vault_events(vault);
    CREATE INDEX IF NOT EXISTS idx_vault_events_type ON vault_events(event_type);

    CREATE TABLE IF NOT EXISTS indexer_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return db;
}

export function getLastProcessedSlot(db: Database.Database): number {
  const row = db
    .prepare("SELECT value FROM indexer_state WHERE key = 'last_slot'")
    .get() as { value: string } | undefined;
  return row ? parseInt(row.value) : 0;
}

export function setLastProcessedSlot(
  db: Database.Database,
  slot: number
): void {
  db.prepare(
    "INSERT OR REPLACE INTO indexer_state (key, value) VALUES ('last_slot', ?)"
  ).run(slot.toString());
}
