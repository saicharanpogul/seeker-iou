import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PROGRAM_ID } from "./constants";
import { ReputationAccount, SettlementRecord } from "./types";
import { deriveReputationPda, deriveVaultPda } from "./utils";

function getProgram(connection: Connection): Program {
  const idl = require("../idl/seeker_iou.json");
  const provider = new AnchorProvider(
    connection,
    {} as any,
    AnchorProvider.defaultOptions()
  );
  return new Program(idl, PROGRAM_ID, provider);
}

/**
 * Fetch reputation for an SGT mint address.
 */
export async function getReputation(
  connection: Connection,
  sgtMint: PublicKey
): Promise<ReputationAccount | null> {
  const [pda] = deriveReputationPda(sgtMint);
  const program = getProgram(connection);

  try {
    const account = await (program.account as any).reputationAccount.fetch(pda);
    return {
      sgtMint: account.sgtMint,
      totalIssued: BigInt(account.totalIssued.toString()),
      totalSettled: BigInt(account.totalSettled.toString()),
      totalFailed: BigInt(account.totalFailed.toString()),
      totalVolume: BigInt(account.totalVolume.toString()),
      lastFailureAt: BigInt(account.lastFailureAt.toString()),
      createdAt: BigInt(account.createdAt.toString()),
      bump: account.bump,
    };
  } catch {
    return null;
  }
}

/**
 * Calculate trust score from reputation data.
 * Returns 0.0 to 1.0. Returns 1.0 if no settlements.
 */
export function calculateTrustScore(reputation: ReputationAccount): number {
  const total = reputation.totalSettled + reputation.totalFailed;
  if (total === 0n) {
    return 1.0;
  }
  return Number(reputation.totalSettled) / Number(total);
}

/**
 * Get settlement history for a vault by scanning accounts.
 */
export async function getSettlementHistory(
  connection: Connection,
  vault: PublicKey
): Promise<SettlementRecord[]> {
  const program = getProgram(connection);

  const accounts = await (program.account as any).settlementRecord.all([
    {
      memcmp: {
        offset: 8, // discriminator
        bytes: vault.toBase58(),
      },
    },
  ]);

  return accounts.map((a: any) => ({
    vault: a.account.vault,
    recipient: a.account.recipient,
    amount: BigInt(a.account.amount.toString()),
    nonce: BigInt(a.account.nonce.toString()),
    settledAt: BigInt(a.account.settledAt.toString()),
    settledBy: a.account.settledBy,
    success: a.account.success,
    bump: a.account.bump,
  }));
}
