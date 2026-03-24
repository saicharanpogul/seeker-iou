import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { useApp } from "../context/AppContext";
import { DEV_MODE, mockDelay } from "../services/devMode";

export function VaultScreen({ navigation }: { navigation: any }) {
  const { vaultState, availableBalance, bondAmount, totalDeposited, refreshState } = useApp();
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      Alert.alert("Invalid amount", "Enter a positive amount.");
      return;
    }

    setDepositing(true);
    try {
      if (DEV_MODE) {
        await mockDelay(1000);
        // In dev mode, just update local state
        if (vaultState) {
          const addAmount = BigInt(Math.floor(parseFloat(depositAmount) * 1_000_000));
          const { saveVaultState, loadVaultState } = await import("../services/storage");
          const current = loadVaultState()!;
          current.depositedAmount = current.depositedAmount + addAmount;
          saveVaultState(current);
          refreshState();
        }
        Alert.alert("Deposited", `${depositAmount} USDC added to vault (dev mode)`);
      } else {
        // Production: call on-chain deposit instruction
        Alert.alert("Deploy first", "Deploy program to devnet before depositing.");
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : String(err));
    } finally {
      setDepositing(false);
      setDepositAmount("");
    }
  };

  const spent = vaultState
    ? (Number(vaultState.spentAmount) / 1_000_000).toFixed(2)
    : "0.00";
  const nonce = vaultState?.currentNonce ?? 0;
  const pendingCount = vaultState?.pendingIOUs?.length ?? 0;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Vault</Text>

      <View style={styles.card}>
        <Row label="Deposited" value={`${totalDeposited} USDC`} />
        <Row label="Spent" value={`${spent} USDC`} />
        <Row label="Available" value={`${availableBalance} USDC`} />
        <Row label="Bond (30%)" value={`${bondAmount} USDC`} />
        <View style={styles.divider} />
        <Row label="Current Nonce" value={String(nonce)} />
        <Row label="Pending IOUs" value={String(pendingCount)} />
      </View>

      <Text style={styles.sectionTitle}>Deposit</Text>
      <View style={styles.depositRow}>
        <TextInput
          style={styles.depositInput}
          value={depositAmount}
          onChangeText={setDepositAmount}
          placeholder="0.00"
          placeholderTextColor="#555"
          keyboardType="decimal-pad"
        />
        <TouchableOpacity
          style={[styles.depositButton, depositing && styles.disabled]}
          onPress={handleDeposit}
          disabled={depositing}
        >
          <Text style={styles.depositButtonText}>
            {depositing ? "..." : "Deposit"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0a0a0a" },
  back: { color: "#7c3aed", fontSize: 16, marginTop: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 16, marginBottom: 24 },
  card: { backgroundColor: "#1a1a1a", borderRadius: 16, padding: 20 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  rowLabel: { fontSize: 14, color: "#888" },
  rowValue: { fontSize: 14, color: "#fff", fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#333", marginVertical: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "600", color: "#fff", marginTop: 28, marginBottom: 12 },
  depositRow: { flexDirection: "row", gap: 12 },
  depositInput: {
    flex: 1, backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16,
    color: "#fff", fontSize: 18, fontWeight: "700", borderWidth: 1, borderColor: "#333",
  },
  depositButton: { backgroundColor: "#7c3aed", paddingHorizontal: 24, borderRadius: 12, justifyContent: "center" },
  depositButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.5 },
});
