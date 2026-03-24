import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert } from "react-native";
import { isDevMode, setDevMode } from "../services/devMode";
import { resetStore, clearAll } from "../services/storage";
import { useApp } from "../context/AppContext";

export function SettingsScreen({ navigation }: { navigation: any }) {
  const { wallet, disconnectWallet } = useApp();
  const [devEnabled, setDevEnabled] = useState(isDevMode());

  const toggleDev = (value: boolean) => {
    setDevMode(value);
    resetStore();
    setDevEnabled(value);
    Alert.alert(
      value ? "Dev Mode ON" : "Dev Mode OFF",
      value
        ? "Wallet, NFC, and settlement are now mocked. Restart the app to apply fully."
        : "Real Seed Vault, NFC, and on-chain operations active."
    );
  };

  const handleClearData = () => {
    Alert.alert("Clear All Data", "This will erase vault state, IOUs, and wallet config.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          clearAll();
          disconnectWallet();
          navigation.navigate("Home");
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Settings</Text>

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Dev Mode</Text>
            <Text style={styles.rowDesc}>
              Mock wallet, NFC, and settlement for testing without Seeker hardware
            </Text>
          </View>
          <Switch
            value={devEnabled}
            onValueChange={toggleDev}
            trackColor={{ false: "#333", true: "#7c3aed" }}
            thumbColor="#fff"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WALLET</Text>
        <Text style={styles.infoText}>
          {wallet ? wallet.toBase58() : "Not connected"}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>DANGER ZONE</Text>
        <TouchableOpacity style={styles.dangerButton} onPress={handleClearData}>
          <Text style={styles.dangerText}>Clear All Local Data</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>seeker-iou v0.1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0a0a0a" },
  back: { color: "#7c3aed", fontSize: 16, marginTop: 16 },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 16, marginBottom: 28 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 11, color: "#888", letterSpacing: 1.5, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#1a1a1a", borderRadius: 14, padding: 16 },
  rowTitle: { fontSize: 16, color: "#fff", fontWeight: "600" },
  rowDesc: { fontSize: 12, color: "#888", marginTop: 4 },
  infoText: { fontSize: 13, color: "#666", fontFamily: "monospace" },
  dangerButton: {
    backgroundColor: "#1a1a1a", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#dc262640", alignItems: "center",
  },
  dangerText: { color: "#dc2626", fontSize: 14, fontWeight: "600" },
  version: { color: "#333", fontSize: 12, textAlign: "center", marginTop: 40 },
});
