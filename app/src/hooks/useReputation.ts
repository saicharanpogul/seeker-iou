import { useState, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import {
  getReputation,
  calculateTrustScore,
  type ReputationAccount,
} from "seeker-iou";
import { connection } from "../services/wallet";

export interface UseReputationReturn {
  reputation: ReputationAccount | null;
  trustScore: number;
  trustLevel: "perfect" | "good" | "caution" | "danger" | "unknown";
  loading: boolean;
  fetch: (sgtMint: PublicKey) => Promise<void>;
}

function getTrustLevel(
  score: number
): "perfect" | "good" | "caution" | "danger" {
  if (score >= 1.0) return "perfect";
  if (score >= 0.95) return "good";
  if (score >= 0.8) return "caution";
  return "danger";
}

export function useReputation(): UseReputationReturn {
  const [reputation, setReputation] = useState<ReputationAccount | null>(null);
  const [loading, setLoading] = useState(false);

  const trustScore = reputation ? calculateTrustScore(reputation) : 1.0;
  const trustLevel = reputation ? getTrustLevel(trustScore) : "unknown";

  const fetch = useCallback(async (sgtMint: PublicKey) => {
    setLoading(true);
    try {
      const rep = await getReputation(connection, sgtMint);
      setReputation(rep);
    } catch (err) {
      console.error("Failed to fetch reputation:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { reputation, trustScore, trustLevel, loading, fetch };
}
