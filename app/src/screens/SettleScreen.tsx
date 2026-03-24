import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { settleAllIOUs, getPendingIOUCount } from "../services/payment";
import { useApp } from "../context/AppContext";

export function SettleScreen({ navigation }: { navigation: any }) {
  const { connected, refreshState } = useApp();
  const [settling, setSettling] = useState(false);
  const [results, setResults] = useState<{ settled: number; failed: number; txSignatures: string[] } | null>(null);
  const pendingCount = getPendingIOUCount();

  const handleSettle = async () => {
    if (!connected) return;
    setSettling(true);
    try {
      const result = await settleAllIOUs();
      setResults(result);
      refreshState();
    } catch (err) {
      setResults({ settled: 0, failed: pendingCount, txSignatures: [] });
    } finally {
      setSettling(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Settle IOUs</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>PENDING IOUs</Text>
        <Text style={styles.statusCount}>{pendingCount}</Text>
        <Text style={styles.statusHint}>
          {pendingCount === 0
            ? "No IOUs to settle. All caught up."
            : "Submit collected IOUs to Solana."}
        </Text>
      </View>

      {pendingCount > 0 && !results && (
        <TouchableOpacity
          style={[styles.settleButton, settling && styles.disabled]}
          onPress={handleSettle}
          disabled={settling}
        >
          {settling ? (
            <View style={styles.settlingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.settleText}>Settling...</Text>
            </View>
          ) : (
            <Text style={styles.settleText}>Settle {pendingCount} IOUs</Text>
          )}
        </TouchableOpacity>
      )}

      {results && (
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>Settlement Complete</Text>

          {results.settled > 0 && (
            <View style={styles.resultRow}>
              <View style={[styles.dot, { backgroundColor: "#059669" }]} />
              <Text style={styles.resultSuccess}>{results.settled} settled</Text>
            </View>
          )}

          {results.failed > 0 && (
            <View style={styles.resultRow}>
              <View style={[styles.dot, { backgroundColor: "#dc2626" }]} />
              <Text style={styles.resultFailed}>{results.failed} failed</Text>
            </View>
          )}

          {results.txSignatures.length > 0 && (
            <View style={styles.txList}>
              <Text style={styles.txLabel}>TRANSACTIONS</Text>
              {results.txSignatures.map((sig, i) => (
                <Text key={i} style={styles.txSig}>
                  {sig.slice(0, 16)}...{sig.slice(-8)}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0a0a0a" },
  back: { color: "#7c3aed", fontSize: 16, marginTop: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 16, marginBottom: 32 },
  statusCard: { backgroundColor: "#1a1a1a", borderRadius: 16, padding: 24, alignItems: "center" },
  statusLabel: { fontSize: 11, color: "#888", letterSpacing: 1.5 },
  statusCount: { fontSize: 56, fontWeight: "700", color: "#fff", marginTop: 8 },
  statusHint: { fontSize: 14, color: "#666", marginTop: 8, textAlign: "center" },
  settleButton: { backgroundColor: "#7c3aed", paddingVertical: 18, borderRadius: 14, alignItems: "center", marginTop: 24 },
  disabled: { opacity: 0.6 },
  settlingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  settleText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  resultsCard: { backgroundColor: "#1a1a1a", borderRadius: 16, padding: 24, marginTop: 24 },
  resultsTitle: { fontSize: 18, fontWeight: "700", color: "#fff", marginBottom: 16, textAlign: "center" },
  resultRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  resultSuccess: { fontSize: 16, color: "#059669", fontWeight: "700" },
  resultFailed: { fontSize: 16, color: "#dc2626", fontWeight: "700" },
  txList: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#333", paddingTop: 12 },
  txLabel: { fontSize: 11, color: "#888", letterSpacing: 1.5, marginBottom: 8 },
  txSig: { fontSize: 12, color: "#666", fontFamily: "monospace", marginBottom: 4 },
  doneButton: { backgroundColor: "#333", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 20 },
  doneText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
