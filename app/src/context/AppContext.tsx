import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  getLocalAvailableBalance,
  calculateBondAmount,
  formatAmount,
  type LocalVaultState,
} from "seeker-iou";
import {
  connectWallet,
  disconnect,
  getPublicKey,
  connection,
} from "../services/wallet";
import {
  loadVaultState,
  saveVaultState,
  loadWalletPubkey,
  saveWalletPubkey,
  loadSgtMint,
  loadTokenMint,
} from "../services/storage";
import { initNFC } from "../services/nfc";
import { getPendingIOUCount } from "../services/payment";
import { isDevMode } from "../services/devMode";
import { deriveVaultPda } from "seeker-iou";
import { Keypair } from "@solana/web3.js";

interface AppState {
  wallet: PublicKey | null;
  connected: boolean;
  vaultState: LocalVaultState | null;
  availableBalance: string;
  bondAmount: string;
  totalDeposited: string;
  pendingIOUs: number;
  nfcReady: boolean;
  loading: boolean;
  connectError: string | null;
  connect: () => Promise<void>;
  disconnectWallet: () => void;
  refreshState: () => void;
  updateVaultState: (state: LocalVaultState) => void;
}

const AppContext = createContext<AppState>({} as AppState);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<PublicKey | null>(null);
  const [vaultState, setVaultState] = useState<LocalVaultState | null>(null);
  const [pendingIOUs, setPendingIOUs] = useState(0);
  const [nfcReady, setNfcReady] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      // Restore wallet
      const savedPubkey = loadWalletPubkey();
      if (savedPubkey) {
        setWallet(new PublicKey(savedPubkey));
      }

      // Restore vault state
      const saved = loadVaultState();
      if (saved) setVaultState(saved);

      // Init NFC (may fail in Expo Go — native module not available)
      try {
        const nfc = await initNFC();
        setNfcReady(nfc);
      } catch (err) {
        console.warn("NFC init failed (expected in Expo Go):", err);
        setNfcReady(false);
      }

      // Count pending IOUs
      setPendingIOUs(getPendingIOUCount());

      setLoading(false);
    };
    init();
  }, []);

  const [connectError, setConnectError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setLoading(true);
    setConnectError(null);
    try {
      const pubkey = await connectWallet();
      setWallet(pubkey);
      saveWalletPubkey(pubkey.toBase58());

      // In dev mode, seed a mock vault with 100 USDC if none exists
      if (isDevMode() && !loadVaultState()) {
        const tokenMint = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
        const [vaultPda] = deriveVaultPda(pubkey, tokenMint);
        const mockState: LocalVaultState = {
          vaultAddress: vaultPda.toBase58(),
          tokenMint: tokenMint.toBase58(),
          depositedAmount: 100_000_000n, // 100 USDC
          spentAmount: 0n,
          currentNonce: 0,
          pendingIOUs: [],
        };
        saveVaultState(mockState);
        setVaultState(mockState);

        const { saveSgtMint, saveTokenMint } = await import("../services/storage");
        saveSgtMint(Keypair.generate().publicKey.toBase58());
        saveTokenMint(tokenMint.toBase58());
        console.log("[DEV] Seeded mock vault with 100 USDC");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Connect failed:", msg);
      if (msg.includes("TurboModule") || msg.includes("SolanaMobileWalletAdapter")) {
        setConnectError(
          "Seed Vault not available. You're running in Expo Go which doesn't support native modules.\n\nEnable Dev Mode to test, or create a dev build with:\nnpx expo run:android"
        );
      } else {
        setConnectError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    disconnect();
    setWallet(null);
  }, []);

  const refreshState = useCallback(() => {
    const saved = loadVaultState();
    if (saved) setVaultState(saved);
    setPendingIOUs(getPendingIOUCount());
  }, []);

  const updateVaultState = useCallback((state: LocalVaultState) => {
    setVaultState(state);
    saveVaultState(state);
  }, []);

  // Derived values
  const decimals = 6; // USDC
  const remaining = vaultState
    ? vaultState.depositedAmount - vaultState.spentAmount
    : 0n;
  const available = vaultState ? getLocalAvailableBalance(vaultState) : 0n;
  const bond = remaining > 0n ? calculateBondAmount(remaining, 3000) : 0n;

  const value: AppState = {
    wallet,
    connected: wallet !== null,
    vaultState,
    availableBalance: formatAmount(available, decimals),
    bondAmount: formatAmount(bond, decimals),
    totalDeposited: vaultState
      ? formatAmount(vaultState.depositedAmount, decimals)
      : "0",
    pendingIOUs,
    nfcReady,
    loading,
    connectError,
    connect,
    disconnectWallet,
    refreshState,
    updateVaultState,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  return useContext(AppContext);
}
