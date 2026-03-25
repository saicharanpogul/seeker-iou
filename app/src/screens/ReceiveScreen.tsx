import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { formatAmount, getReputation, calculateTrustScore } from "seeker-iou";
import { PublicKey, Connection } from "@solana/web3.js";
import { receivePayment } from "../services/payment";
import { cancelNFC, initNFC } from "../services/nfc";
import { useApp } from "../context/AppContext";
import { isDevMode } from "../services/devMode";

const mainnetConnection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

type NfcStatus = "initializing" | "ready" | "scanning" | "failed";

export function ReceiveScreen({ navigation }: { navigation: any }) {
  const { refreshState } = useApp();
  const [status, setStatus] = useState<"waiting" | "received" | "error">("waiting");
  const [nfcStatus, setNfcStatus] = useState<NfcStatus>("initializing");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [senderDisplay, setSenderDisplay] = useState("");
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const listen = async () => {
      // Step 1: Init NFC
      setNfcStatus("initializing");
      try {
        const ready = await initNFC();
        if (!ready && !isDevMode()) {
          setNfcStatus("failed");
          setStatus("error");
          setError("NFC is not available on this device.");
          return;
        }
        setNfcStatus("ready");
      } catch (err) {
        setNfcStatus("failed");
        setStatus("error");
        setError("NFC init failed: " + (err instanceof Error ? err.message : String(err)));
        return;
      }

      // Step 2: Start scanning
      setNfcStatus("scanning");

      const result = await receivePayment();

      if (cancelled) return;

      if (!result) {
        setStatus("error");
        setError("No payment received. Tap did not contain a valid IOU.");
        return;
      }

      setReceivedAmount(formatAmount(result.iou.amount, 6));
      setSenderDisplay(result.senderDisplay);

      // Fetch trust score (mainnet for reputation if deployed there, devnet otherwise)
      try {
        const rep = await getReputation(
          mainnetConnection,
          new PublicKey(result.iou.senderSgtMint)
        );
        if (rep) setTrustScore(calculateTrustScore(rep));
      } catch {}

      setStatus("received");
      refreshState();
    };

    listen();

    return () => {
      cancelled = true;
      cancelNFC();
    };
  }, []);

  const trustColor =
    trustScore === null ? "#888"
    : trustScore >= 0.95 ? "#059669"
    : trustScore >= 0.8 ? "#d97706"
    : "#dc2626";

  const trustLabel =
    trustScore === null ? "Loading..."
    : trustScore >= 0.95 ? "Trusted"
    : trustScore >= 0.8 ? "Caution"
    : "High Risk";

  const nfcStatusColor =
    nfcStatus === "scanning" ? "#059669"
    : nfcStatus === "ready" ? "#d97706"
    : nfcStatus === "failed" ? "#dc2626"
    : "#888";

  const nfcStatusText =
    nfcStatus === "initializing" ? "Initializing NFC..."
    : nfcStatus === "ready" ? "NFC ready"
    : nfcStatus === "scanning" ? "NFC active"
    : "NFC unavailable";

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => { cancelNFC(); navigation.goBack(); }}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Receive Payment</Text>

      {/* NFC status indicator — always visible */}
      <View style={[styles.nfcStatusBar, { borderColor: nfcStatusColor + "40" }]}>
        <View style={[styles.nfcDot, { backgroundColor: nfcStatusColor }]} />
        <Text style={[styles.nfcStatusText, { color: nfcStatusColor }]}>
          {nfcStatusText}
        </Text>
      </View>

      {status === "waiting" && (
        <View style={styles.waitingContainer}>
          {nfcStatus === "scanning" ? (
            <>
              <ActivityIndicator size="large" color="#059669" style={{ marginBottom: 24 }} />
              <Text style={styles.waitingText}>
                Hold your phone near{"\n"}the sender's Seeker
              </Text>
              <Text style={styles.waitingHint}>
                {isDevMode() ? "Dev mode: auto-receive in 2s..." : "Waiting for NFC tap..."}
              </Text>
            </>
          ) : nfcStatus === "initializing" ? (
            <>
              <ActivityIndicator size="large" color="#888" style={{ marginBottom: 24 }} />
              <Text style={styles.waitingText}>Starting NFC...</Text>
            </>
          ) : null}
        </View>
      )}

      {status === "received" && (
        <View style={styles.receivedCard}>
          <Text style={styles.receivedLabel}>INCOMING PAYMENT</Text>
          <Text style={styles.receivedAmount}>{receivedAmount} USDC</Text>

          <View style={styles.senderRow}>
            <Text style={styles.senderLabel}>From</Text>
            <Text style={styles.senderValue}>{senderDisplay}</Text>
          </View>

          <View style={styles.trustRow}>
            <Text style={styles.trustLabel}>Trust</Text>
            <View style={[styles.trustBadge, { backgroundColor: trustColor + "20" }]}>
              <Text style={[styles.trustText, { color: trustColor }]}>
                {trustScore !== null ? `${(trustScore * 100).toFixed(1)}%` : "..."} {trustLabel}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.acceptButton} onPress={() => navigation.goBack()}>
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === "error" && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => {
            setStatus("waiting");
            setNfcStatus("initializing");
            setError("");
          }}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0a0a0a" },
  back: { color: "#059669", fontSize: 16, marginTop: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 16, marginBottom: 20 },
  nfcStatusBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#1a1a1a", borderRadius: 12, padding: 14,
    borderWidth: 1, marginBottom: 24,
  },
  nfcDot: { width: 10, height: 10, borderRadius: 5 },
  nfcStatusText: { fontSize: 14, fontWeight: "600" },
  waitingContainer: { alignItems: "center", marginTop: 48 },
  waitingText: { color: "#ccc", fontSize: 18, textAlign: "center", marginBottom: 16, lineHeight: 26 },
  waitingHint: { color: "#666", fontSize: 14 },
  receivedCard: { backgroundColor: "#1a1a1a", borderRadius: 16, padding: 24 },
  receivedLabel: { fontSize: 11, color: "#888", letterSpacing: 1.5 },
  receivedAmount: { fontSize: 40, fontWeight: "700", color: "#059669", marginTop: 8, marginBottom: 20 },
  senderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  senderLabel: { fontSize: 14, color: "#888" },
  senderValue: { fontSize: 14, color: "#fff", fontWeight: "600" },
  trustRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  trustLabel: { fontSize: 14, color: "#888" },
  trustBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  trustText: { fontSize: 14, fontWeight: "700" },
  acceptButton: { backgroundColor: "#059669", paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  acceptButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  errorContainer: { alignItems: "center", marginTop: 48 },
  errorText: { color: "#dc2626", fontSize: 16, marginBottom: 16, textAlign: "center" },
  retryButton: { backgroundColor: "#1a1a1a", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, borderWidth: 1, borderColor: "#333" },
  retryText: { color: "#fff", fontSize: 16 },
});
