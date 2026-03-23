/**
 * Hook for vault state management.
 * Syncs between on-chain state and local offline state.
 */

import { useState, useCallback, useEffect } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  deriveVaultPda,
  getLocalAvailableBalance,
  calculateBondAmount,
  calculateAvailableForIOUs,
  type LocalVaultState,
  type VaultAccount,
} from "seeker-iou";
import { connection } from "../services/wallet";
import { saveVaultState, loadVaultState } from "../services/storage";

export interface UseVaultReturn {
  localState: LocalVaultState | null;
  availableBalance: bigint;
  bondAmount: bigint;
  isOnline: boolean;
  syncWithChain: () => Promise<void>;
  setLocalState: (state: LocalVaultState) => void;
}

export function useVault(
  owner: PublicKey | null,
  tokenMint: PublicKey | null
): UseVaultReturn {
  const [localState, setLocalStateInner] = useState<LocalVaultState | null>(
    null
  );
  const [isOnline, setIsOnline] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    const saved = loadVaultState();
    if (saved) setLocalStateInner(saved);
  }, []);

  const setLocalState = useCallback((state: LocalVaultState) => {
    setLocalStateInner(state);
    saveVaultState(state);
  }, []);

  const syncWithChain = useCallback(async () => {
    if (!owner || !tokenMint) return;

    try {
      const [vaultPda] = deriveVaultPda(owner, tokenMint);
      // Fetch on-chain vault account
      const accountInfo = await connection.getAccountInfo(vaultPda);
      if (!accountInfo) return;

      // TODO: Deserialize vault account from on-chain data
      // For now, mark as online
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  }, [owner, tokenMint]);

  const availableBalance = localState
    ? getLocalAvailableBalance(localState)
    : 0n;

  const remaining = localState
    ? localState.depositedAmount - localState.spentAmount
    : 0n;

  const bondAmount = localState
    ? calculateBondAmount(remaining, 3000) // TODO: read from vault state
    : 0n;

  return {
    localState,
    availableBalance,
    bondAmount,
    isOnline,
    syncWithChain,
    setLocalState,
  };
}
