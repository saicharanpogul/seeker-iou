import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from "react-native";

interface PayScreenProps {
  navigation: any;
}

export function PayScreen({ navigation }: PayScreenProps) {
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<"idle" | "ready" | "tapping" | "done">("idle");

  const handlePay = () => {
    setStatus("tapping");
    // In production:
    // 1. createIOUMessage with amount, memo, next nonce
    // 2. signMessage via Seed Vault
    // 3. sendIOUViaNFC
    // 4. trackIssuedIOU to update local state
    // 5. saveVaultState
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Send Payment</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Amount (USDC)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#666"
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Memo (optional)</Text>
        <TextInput
          style={styles.input}
          value={memo}
          onChangeText={setMemo}
          placeholder="mangoes, chai x2..."
          placeholderTextColor="#666"
          maxLength={32}
        />
      </View>

      {status === "idle" && (
        <TouchableOpacity style={styles.payButton} onPress={handlePay}>
          <Text style={styles.payButtonText}>Tap to Pay</Text>
        </TouchableOpacity>
      )}

      {status === "tapping" && (
        <View style={styles.tappingContainer}>
          <Text style={styles.tappingText}>Hold phones together...</Text>
          <Text style={styles.tappingEmoji}>📱 ← NFC → 📱</Text>
        </View>
      )}

      {status === "done" && (
        <View style={styles.doneContainer}>
          <Text style={styles.doneText}>Payment sent!</Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0a0a0a" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 16, marginBottom: 32 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, color: "#fff", fontSize: 18, borderWidth: 1, borderColor: "#333" },
  payButton: { backgroundColor: "#7c3aed", paddingVertical: 18, borderRadius: 12, alignItems: "center", marginTop: 24 },
  payButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  tappingContainer: { alignItems: "center", marginTop: 48 },
  tappingText: { color: "#ccc", fontSize: 16, marginBottom: 16 },
  tappingEmoji: { fontSize: 24 },
  doneContainer: { alignItems: "center", marginTop: 48 },
  doneText: { color: "#059669", fontSize: 20, fontWeight: "700", marginBottom: 16 },
  doneButton: { backgroundColor: "#1a1a1a", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  doneButtonText: { color: "#fff", fontSize: 16 },
});
