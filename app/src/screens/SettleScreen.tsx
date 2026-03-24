import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList } from "react-native";
import { formatAmount, type ReceivedIOU } from "seeker-iou";
import { settleAllIOUs, getPendingIOUCount } from "../services/payment";
import { loadReceivedIOUs } from "../services/storage";
import { useApp } from "../context/AppContext";

export function SettleScreen({ navigation }: { navigation: any }) {
  const { connected, refreshState } = useApp();
  const [settling, setSettling] = useState(false);
  const [results, setResults] = useState<{ settled: number; failed: number; txSignatures: string[] } | null>(null);
  const [allIOUs, setAllIOUs] = useState<ReceivedIOU[]>([]);

  const pendingCount = allIOUs.filter((i) => !i.settled).length;
  const settledCount = allIOUs.filter((i) => i.settled).length;

  useEffect(() => {
    setAllIOUs(loadReceivedIOUs());
  }, []);

  const handleSettle = async () => {
    if (!connected) return;
    setSettling(true);
    try {
      const result = await settleAllIOUs();
      setResults(result);
      setAllIOUs(loadReceivedIOUs());
      refreshState();
    } catch {
      setResults({ settled: 0, failed: pendingCount, txSignatures: [] });
    } finally {
      setSettling(false);
    }
  };

  const renderIOU = ({ item }: { item: ReceivedIOU }) => {
    const amount = formatAmount(item.amount, 6);
    const from = item.sender.slice(0, 6) + "..." + item.sender.slice(-4);
    const date = new Date(item.receivedAt).toLocaleString();

    return (
      <View style={styles.iouRow}>
        <View style={styles.iouLeft}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.dot, { backgroundColor: item.settled ? "#059669" : "#d97706" }]} />
            <Text style={styles.iouAmount}>{amount} USDC</Text>
          </View>
          <Text style={styles.iouFrom}>From {from}</Text>
          <Text style={styles.iouDate}>{date}</Text>
        </View>
        <View style={styles.iouRight}>
          <Text style={[styles.iouStatus, { color: item.settled ? "#059669" : "#d97706" }]}>
            {item.settled ? "Settled" : "Pending"}
          </Text>
          {item.settlementTx && (
            <Text style={styles.iouTx}>
              {item.settlementTx.slice(0, 8)}...
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Settle IOUs</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statCount}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statCount, { color: "#059669" }]}>{settledCount}</Text>
          <Text style={styles.statLabel}>Settled</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCount}>{allIOUs.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
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
          {results.settled > 0 && (
            <Text style={styles.resultSuccess}>{results.settled} settled</Text>
          )}
          {results.failed > 0 && (
            <Text style={styles.resultFailed}>{results.failed} failed</Text>
          )}
        </View>
      )}

      {allIOUs.length > 0 && (
        <>
          <Text style={styles.historyTitle}>HISTORY</Text>
          <FlatList
            data={allIOUs.sort((a, b) => b.receivedAt - a.receivedAt)}
            renderItem={renderIOU}
            keyExtractor={(item) => `${item.sender}-${item.nonce}`}
            style={styles.list}
          />
        </>
      )}

      {allIOUs.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No IOUs received yet.</Text>
          <Text style={styles.emptyHint}>Tap "Receive" on the home screen to accept payments.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0a0a0a" },
  back: { color: "#7c3aed", fontSize: 16, marginTop: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 16, marginBottom: 24 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 14, padding: 16, alignItems: "center" },
  statCount: { fontSize: 28, fontWeight: "700", color: "#fff" },
  statLabel: { fontSize: 11, color: "#888", marginTop: 4, letterSpacing: 1 },
  settleButton: { backgroundColor: "#7c3aed", paddingVertical: 18, borderRadius: 14, alignItems: "center", marginBottom: 20 },
  disabled: { opacity: 0.6 },
  settlingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  settleText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  resultsCard: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 16, flexDirection: "row", gap: 16, justifyContent: "center", marginBottom: 20 },
  resultSuccess: { fontSize: 16, color: "#059669", fontWeight: "700" },
  resultFailed: { fontSize: 16, color: "#dc2626", fontWeight: "700" },
  historyTitle: { fontSize: 11, color: "#888", letterSpacing: 1.5, marginBottom: 12 },
  list: { flex: 1 },
  iouRow: { flexDirection: "row", backgroundColor: "#1a1a1a", borderRadius: 12, padding: 14, marginBottom: 8 },
  iouLeft: { flex: 1 },
  iouRight: { alignItems: "flex-end", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  iouAmount: { fontSize: 16, color: "#fff", fontWeight: "700" },
  iouFrom: { fontSize: 12, color: "#888", marginTop: 4, fontFamily: "monospace" },
  iouDate: { fontSize: 11, color: "#555", marginTop: 2 },
  iouStatus: { fontSize: 13, fontWeight: "700" },
  iouTx: { fontSize: 10, color: "#555", fontFamily: "monospace", marginTop: 2 },
  emptyContainer: { alignItems: "center", marginTop: 48 },
  emptyText: { color: "#666", fontSize: 16 },
  emptyHint: { color: "#444", fontSize: 13, marginTop: 8, textAlign: "center" },
});
