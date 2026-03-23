import { BorshCoder, EventParser } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

// Load IDL at runtime
import idl from "../../sdk/idl/seeker_iou.json";

const PROGRAM_ID = new PublicKey(
  "Appq4U1rTS4tCo4E84qhQs777z3awXf6K55amgnZ5srC"
);

export interface SettlementEvent {
  type: "IOUSettled" | "IOUFailed";
  vault: string;
  recipient: string;
  amount: bigint;
  nonce: bigint;
  settler: string;
  slashAmount?: bigint;
}

export interface VaultEvent {
  type:
    | "VaultCreated"
    | "Deposited"
    | "VaultDeactivated"
    | "VaultReactivated"
    | "VaultWithdrawn"
    | "ReserveRatioUpdated"
    | "CooldownUpdated";
  vault: string;
  owner?: string;
  amount?: bigint;
  data?: Record<string, unknown>;
}

export type ParsedEvent = SettlementEvent | VaultEvent;

const coder = new BorshCoder(idl as any);
const eventParser = new EventParser(PROGRAM_ID, coder);

export function parseTransactionLogs(logs: string[]): ParsedEvent[] {
  const events: ParsedEvent[] = [];

  const parsed = eventParser.parseLogs(logs);
  for (const event of parsed) {
    switch (event.name) {
      case "IOUSettled":
        events.push({
          type: "IOUSettled",
          vault: event.data.vault.toBase58(),
          recipient: event.data.recipient.toBase58(),
          amount: BigInt(event.data.amount.toString()),
          nonce: BigInt(event.data.nonce.toString()),
          settler: event.data.settler.toBase58(),
        });
        break;

      case "IOUFailed":
        events.push({
          type: "IOUFailed",
          vault: event.data.vault.toBase58(),
          recipient: event.data.recipient.toBase58(),
          amount: BigInt(event.data.amount.toString()),
          nonce: BigInt(event.data.nonce.toString()),
          settler: event.data.settler.toBase58(),
          slashAmount: BigInt(
            (event.data.slashAmount || event.data.slash_amount || 0).toString()
          ),
        });
        break;

      case "VaultCreated":
        events.push({
          type: "VaultCreated",
          vault: event.data.vault.toBase58(),
          owner: event.data.owner.toBase58(),
          data: {
            tokenMint: event.data.tokenMint?.toBase58() || event.data.token_mint?.toBase58(),
            sgtMint: event.data.sgtMint?.toBase58() || event.data.sgt_mint?.toBase58(),
          },
        });
        break;

      case "Deposited":
        events.push({
          type: "Deposited",
          vault: event.data.vault.toBase58(),
          amount: BigInt(event.data.amount.toString()),
          data: {
            newTotal: BigInt(
              (event.data.newTotal || event.data.new_total).toString()
            ),
          },
        });
        break;

      case "VaultDeactivated":
      case "VaultReactivated":
        events.push({
          type: event.name as VaultEvent["type"],
          vault: event.data.vault.toBase58(),
          owner: event.data.owner.toBase58(),
        });
        break;

      case "VaultWithdrawn":
        events.push({
          type: "VaultWithdrawn",
          vault: event.data.vault.toBase58(),
          owner: event.data.owner.toBase58(),
          amount: BigInt(event.data.amount.toString()),
        });
        break;

      case "ReserveRatioUpdated":
        events.push({
          type: "ReserveRatioUpdated",
          vault: event.data.vault.toBase58(),
          owner: event.data.owner.toBase58(),
          data: {
            oldRatioBps: event.data.oldRatioBps || event.data.old_ratio_bps,
            newRatioBps: event.data.newRatioBps || event.data.new_ratio_bps,
          },
        });
        break;

      case "CooldownUpdated":
        events.push({
          type: "CooldownUpdated",
          vault: event.data.vault.toBase58(),
          owner: event.data.owner.toBase58(),
          data: {
            oldCooldown: event.data.oldCooldown || event.data.old_cooldown,
            newCooldown: event.data.newCooldown || event.data.new_cooldown,
          },
        });
        break;
    }
  }

  return events;
}

export { PROGRAM_ID };
