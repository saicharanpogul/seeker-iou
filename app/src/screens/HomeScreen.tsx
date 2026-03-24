import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Switch } from "react-native";
import { useApp } from "../context/AppContext";
import { isDevMode, setDevMode } from "../services/devMode";

export function HomeScreen({ navigation }: { navigation: any }) {
  const {
    connected, wallet, availableBalance, bondAmount, totalDeposited,
    pendingIOUs, nfcReady, loading, connect,
  } = useApp();

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  const [devToggle, setDevToggle] = useState(isDevMode());

  if (!connected) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.title}>seeker-iou</Text>
        <Text style={styles.subtitle}>Offline payments for Seeker</Text>

        <TouchableOpacity style={styles.connectButton} onPress={connect}>
          <Text style={styles.connectButtonText}>
            {devToggle ? "Connect (Dev Mode)" : "Connect with Seed Vault"}
          </Text>
        </TouchableOpacity>

        <View style={styles.devToggleRow}>
          <Switch
            value={devToggle}
            onValueChange={(v) => {
              setDevToggle(v);
              setDevMode(v);
            }}
            trackColor={{ false: "#333", true: "#7c3aed" }}
            thumbColor="#fff"
          />
          <Text style={styles.devToggleLabel}>
            {devToggle ? "Dev Mode — mock wallet & NFC" : "Production — Seed Vault & NFC hardware"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.title}>seeker-iou</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Settings")} style={styles.settingsBtn}>
            <Text style={styles.settingsIcon}>Settings</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statusRow}>
          {isDevMode() && <Text style={styles.devBadge}>DEV</Text>}
          {nfcReady && <Text style={styles.nfcBadge}>NFC</Text>}
          <Text style={styles.walletAddr}>
            {isDevMode() ? "Dev Wallet" : "Seed Vault"} {wallet!.toBase58().slice(0, 4)}...{wallet!.toBase58().slice(-4)}
          </Text>
        </View>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>AVAILABLE FOR PAYMENTS</Text>
        <Text style={styles.balanceAmount}>{availableBalance} USDC</Text>
        <View style={styles.balanceDetails}>
          <Text style={styles.detailText}>Deposited: {totalDeposited} USDC</Text>
          <Text style={styles.detailText}>Bond (30%): {bondAmount} USDC</Text>
        </View>
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.payBtn]} onPress={() => navigation.navigate("Pay")}>
          <Text style={styles.btnText}>Pay</Text>
          <Text style={styles.btnHint}>Tap to send</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.recvBtn]} onPress={() => navigation.navigate("Receive")}>
          <Text style={styles.btnText}>Receive</Text>
          <Text style={styles.btnHint}>Wait for tap</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.row}>
        <TouchableOpacity style={[styles.btn, styles.secBtn]} onPress={() => navigation.navigate("Vault")}>
          <Text style={styles.secBtnText}>Manage Vault</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.secBtn, { position: "relative" }]} onPress={() => navigation.navigate("Settle")}>
          <Text style={styles.secBtnText}>Settle{pendingIOUs > 0 ? ` (${pendingIOUs})` : ""}</Text>
          {pendingIOUs > 0 && <View style={styles.badge} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0a0a0a" },
  center: { justifyContent: "center", alignItems: "center" },
  header: { marginTop: 48, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 14, color: "#888", marginTop: 4, marginBottom: 32 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  devBadge: { fontSize: 11, color: "#d97706", backgroundColor: "#d9770620", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  nfcBadge: { fontSize: 11, color: "#059669", backgroundColor: "#05966920", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
  walletAddr: { fontSize: 12, color: "#666", fontFamily: "monospace" },
  settingsBtn: { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: "#1a1a1a", borderRadius: 8, borderWidth: 1, borderColor: "#333" },
  settingsIcon: { color: "#888", fontSize: 13 },
  balanceCard: { backgroundColor: "#1a1a1a", borderRadius: 16, padding: 24, marginBottom: 32 },
  balanceLabel: { fontSize: 11, color: "#888", letterSpacing: 1.5 },
  balanceAmount: { fontSize: 36, fontWeight: "700", color: "#fff", marginTop: 8 },
  balanceDetails: { marginTop: 12, gap: 4 },
  detailText: { fontSize: 13, color: "#666" },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  btn: { flex: 1, paddingVertical: 20, borderRadius: 14, alignItems: "center" },
  payBtn: { backgroundColor: "#7c3aed" },
  recvBtn: { backgroundColor: "#059669" },
  secBtn: { backgroundColor: "#1a1a1a", borderWidth: 1, borderColor: "#333" },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  btnHint: { color: "#ffffff80", fontSize: 12, marginTop: 2 },
  secBtnText: { color: "#ccc", fontSize: 14, fontWeight: "500" },
  connectButton: { backgroundColor: "#7c3aed", paddingVertical: 16, paddingHorizontal: 48, borderRadius: 14 },
  connectButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  devToggleRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 24 },
  devToggleLabel: { color: "#888", fontSize: 13, flex: 1 },
  badge: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: "#dc2626" },
});
