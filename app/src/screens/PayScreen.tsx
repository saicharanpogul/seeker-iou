import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { PublicKey, Keypair } from "@solana/web3.js";
import { parseAmount, formatAmount, isSkrDomain } from "seeker-iou";
import { sendPayment } from "../services/payment";
import { useApp } from "../context/AppContext";
import { DEV_MODE } from "../services/devMode";

export function PayScreen({ navigation }: { navigation: any }) {
  const { refreshState } = useApp();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<"idle" | "signing" | "tapping" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const handlePay = async () => {
    if (!recipient || !amount) {
      Alert.alert("Missing fields", "Enter recipient address and amount.");
      return;
    }

    let recipientPk: PublicKey;
    const input = recipient.trim();

    if (isSkrDomain(input)) {
      // .skr domain — resolve to address
      if (DEV_MODE) {
        // In dev mode, generate a deterministic address for the domain
        recipientPk = Keypair.generate().publicKey;
        console.log(`[DEV] Resolved ${input} → ${recipientPk.toBase58()}`);
      } else {
        try {
          const { resolveSkrDomain } = await import("seeker-iou");
          const { connection } = await import("../services/wallet");
          const resolved = await resolveSkrDomain(connection, input);
          if (!resolved) {
            Alert.alert("Domain not found", `Could not resolve ${input}`);
            return;
          }
          recipientPk = new PublicKey(resolved);
        } catch {
          Alert.alert("Resolution failed", `Could not resolve ${input}`);
          return;
        }
      }
    } else {
      try {
        recipientPk = new PublicKey(input);
      } catch {
        Alert.alert("Invalid address", "Enter a valid Solana address or .skr domain.");
        return;
      }
    }

    const amountRaw = parseAmount(amount, 6); // USDC 6 decimals
    if (amountRaw <= 0n) {
      Alert.alert("Invalid amount", "Amount must be greater than 0.");
      return;
    }

    try {
      setStatus("signing");

      const result = await sendPayment({
        recipient: recipientPk,
        amount: amountRaw,
        memo: memo || undefined,
      });

      setStatus("done");
      refreshState();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.back}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Send Payment</Text>

      {status === "idle" && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>RECIPIENT ADDRESS</Text>
            <TextInput
              style={styles.input}
              value={recipient}
              onChangeText={setRecipient}
              placeholder="Solana address or .skr domain"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>AMOUNT (USDC)</Text>
            <TextInput
              style={[styles.input, styles.amountInput]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>MEMO (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={memo}
              onChangeText={setMemo}
              placeholder="mangoes, chai x2..."
              placeholderTextColor="#555"
              maxLength={32}
            />
          </View>

          <TouchableOpacity style={styles.payButton} onPress={handlePay}>
            <Text style={styles.payButtonText}>Sign & Tap to Pay</Text>
          </TouchableOpacity>
        </>
      )}

      {status === "signing" && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>Signing with Seed Vault...</Text>
          <Text style={styles.statusHint}>Confirm with fingerprint</Text>
        </View>
      )}

      {status === "done" && (
        <View style={styles.statusContainer}>
          <Text style={styles.successText}>Payment sent!</Text>
          <Text style={styles.successAmount}>{amount} USDC</Text>
          <TouchableOpacity style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === "error" && (
        <View style={styles.statusContainer}>
          <Text style={styles.errorText}>Failed</Text>
          <Text style={styles.errorDetail}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => setStatus("idle")}>
            <Text style={styles.doneButtonText}>Try Again</Text>
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
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 11, color: "#888", letterSpacing: 1.5, marginBottom: 8 },
  input: { backgroundColor: "#1a1a1a", borderRadius: 12, padding: 16, color: "#fff", fontSize: 16, borderWidth: 1, borderColor: "#333" },
  amountInput: { fontSize: 24, fontWeight: "700" },
  payButton: { backgroundColor: "#7c3aed", paddingVertical: 18, borderRadius: 14, alignItems: "center", marginTop: 16 },
  payButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  statusContainer: { alignItems: "center", marginTop: 64 },
  statusText: { color: "#ccc", fontSize: 18, marginBottom: 8 },
  statusHint: { color: "#666", fontSize: 14 },
  successText: { color: "#059669", fontSize: 24, fontWeight: "700" },
  successAmount: { color: "#fff", fontSize: 36, fontWeight: "700", marginTop: 8, marginBottom: 24 },
  errorText: { color: "#dc2626", fontSize: 24, fontWeight: "700" },
  errorDetail: { color: "#888", fontSize: 14, marginTop: 8, marginBottom: 24, textAlign: "center" },
  doneButton: { backgroundColor: "#1a1a1a", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, borderWidth: 1, borderColor: "#333" },
  retryButton: { backgroundColor: "#7c3aed", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  doneButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
