import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from "react-native";

interface SettleScreenProps {
  navigation: any;
}

export function SettleScreen({ navigation }: SettleScreenProps) {
  const [settling, setSettling] = useState(false);
  const [results, setResults] = useState<{ settled: number; failed: number } | null>(null);

  // In production, load from storage:
  // const receivedIOUs = loadReceivedIOUs().filter(iou => !iou.settled);
  const pendingCount = 0;

  const handleSettle = async () => {
    setSettling(true);
    // In production:
    // const result = await settleIOUs({ settler: walletPublicKey, receivedIOUs });
    // setResults(result);
    // saveReceivedIOUs(receivedIOUs);
    setSettling(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settle IOUs</Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Pending IOUs</Text>
        <Text style={styles.statusCount}>{pendingCount}</Text>
        <Text style={styles.statusHint}>
          {pendingCount === 0
            ? "No IOUs to settle"
            : "Submit collected IOUs to the blockchain"}
        </Text>
      </View>

      {pendingCount > 0 && (
        <TouchableOpacity
          style={[styles.settleButton, settling && styles.settleButtonDisabled]}
          onPress={handleSettle}
          disabled={settling}
        >
          <Text style={styles.settleButtonText}>
            {settling ? "Settling..." : `Settle ${pendingCount} IOUs`}
          </Text>
        </TouchableOpacity>
      )}

      {results && (
        <View style={styles.resultsCard}>
          <Text style={styles.resultsTitle}>Settlement Complete</Text>
          <Text style={styles.resultSuccess}>{results.settled} settled</Text>
          {results.failed > 0 && (
            <Text style={styles.resultFailed}>{results.failed} failed</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0a0a0a" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 16, marginBottom: 32 },
  statusCard: { backgroundColor: "#1a1a1a", borderRadius: 16, padding: 24, alignItems: "center" },
  statusLabel: { fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 },
  statusCount: { fontSize: 48, fontWeight: "700", color: "#fff", marginTop: 8 },
  statusHint: { fontSize: 14, color: "#666", marginTop: 8 },
  settleButton: { backgroundColor: "#7c3aed", paddingVertical: 18, borderRadius: 12, alignItems: "center", marginTop: 24 },
  settleButtonDisabled: { opacity: 0.5 },
  settleButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  resultsCard: { backgroundColor: "#1a1a1a", borderRadius: 16, padding: 24, marginTop: 24, alignItems: "center" },
  resultsTitle: { fontSize: 16, fontWeight: "600", color: "#fff", marginBottom: 12 },
  resultSuccess: { fontSize: 18, color: "#059669", fontWeight: "700" },
  resultFailed: { fontSize: 14, color: "#dc2626", marginTop: 4 },
});
