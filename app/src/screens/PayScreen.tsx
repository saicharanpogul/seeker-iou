import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from "react-native";
import { PublicKey, Keypair, Connection } from "@solana/web3.js";
import { parseAmount, isSkrDomain, resolveSkrDomain } from "seeker-iou";
import { sendPayment } from "../services/payment";
import { useApp } from "../context/AppContext";
import { isDevMode } from "../services/devMode";

// Mainnet connection for .skr domain resolution
const mainnetConnection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");

export function PayScreen({ navigation }: { navigation: any }) {
  const { refreshState } = useApp();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [error, setError] = useState("");

  // Live .skr domain resolution preview
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const input = recipient.trim();
    if (!isSkrDomain(input)) {
      setResolvedAddress(null);
      return;
    }

    setResolving(true);
    const timer = setTimeout(async () => {
      if (isDevMode()) {
        // Deterministic fake address from domain name
        const seed = new TextEncoder().encode(input.padEnd(32, "\0"));
        const fakeAddr = Keypair.generate().publicKey.toBase58();
        setResolvedAddress(fakeAddr);
        setResolving(false);
      } else {
        try {
          const resolved = await resolveSkrDomain(mainnetConnection, input);
          setResolvedAddress(resolved);
        } catch {
          setResolvedAddress(null);
        } finally {
          setResolving(false);
        }
      }
    }, 500); // Debounce 500ms

    return () => clearTimeout(timer);
  }, [recipient]);

  const handlePay = async () => {
    if (!recipient || !amount) {
      Alert.alert("Missing fields", "Enter recipient and amount.");
      return;
    }

    let recipientPk: PublicKey;
    const input = recipient.trim();

    if (isSkrDomain(input)) {
      if (resolvedAddress) {
        recipientPk = new PublicKey(resolvedAddress);
      } else {
        Alert.alert("Domain not found", `Could not resolve ${input}`);
        return;
      }
    } else {
      try {
        recipientPk = new PublicKey(input);
      } catch {
        Alert.alert("Invalid address", "Enter a valid Solana address or .skr domain.");
        return;
      }
    }

    const amountRaw = parseAmount(amount, 6);
    if (amountRaw <= 0n) {
      Alert.alert("Invalid amount", "Amount must be greater than 0.");
      return;
    }

    try {
      setStatus("signing");
      await sendPayment({
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
            <Text style={styles.label}>RECIPIENT</Text>
            <TextInput
              style={styles.input}
              value={recipient}
              onChangeText={setRecipient}
              placeholder=".skr domain or Solana address"
              placeholderTextColor="#555"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {/* Live .skr resolution preview */}
            {isSkrDomain(recipient.trim()) && (
              <View style={styles.resolveRow}>
                {resolving ? (
                  <Text style={styles.resolvingText}>Resolving...</Text>
                ) : resolvedAddress ? (
                  <View>
                    <Text style={styles.resolvedLabel}>Resolved address:</Text>
                    <Text style={styles.resolvedAddr}>
                      {resolvedAddress.slice(0, 12)}...{resolvedAddress.slice(-8)}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.resolveError}>Domain not found</Text>
                )}
              </View>
            )}
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
          <Text style={styles.statusText}>
            {isDevMode() ? "Signing (dev mode)..." : "Signing with Seed Vault..."}
          </Text>
          {!isDevMode() && <Text style={styles.statusHint}>Confirm with fingerprint</Text>}
        </View>
      )}

      {status === "done" && (
        <View style={styles.statusContainer}>
          <Text style={styles.successText}>Payment sent!</Text>
          <Text style={styles.successAmount}>{amount} USDC</Text>
          {isSkrDomain(recipient.trim()) && (
            <Text style={styles.recipientDisplay}>to {recipient.trim()}</Text>
          )}
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
  resolveRow: { marginTop: 8, paddingHorizontal: 4 },
  resolvingText: { color: "#888", fontSize: 12 },
  resolvedLabel: { color: "#888", fontSize: 11, marginBottom: 2 },
  resolvedAddr: { color: "#7c3aed", fontSize: 13, fontFamily: "monospace" },
  resolveError: { color: "#dc2626", fontSize: 12 },
  payButton: { backgroundColor: "#7c3aed", paddingVertical: 18, borderRadius: 14, alignItems: "center", marginTop: 16 },
  payButtonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  statusContainer: { alignItems: "center", marginTop: 64 },
  statusText: { color: "#ccc", fontSize: 18, marginBottom: 8 },
  statusHint: { color: "#666", fontSize: 14 },
  successText: { color: "#059669", fontSize: 24, fontWeight: "700" },
  successAmount: { color: "#fff", fontSize: 36, fontWeight: "700", marginTop: 8 },
  recipientDisplay: { color: "#888", fontSize: 14, marginTop: 4, marginBottom: 24 },
  errorText: { color: "#dc2626", fontSize: 24, fontWeight: "700" },
  errorDetail: { color: "#888", fontSize: 14, marginTop: 8, marginBottom: 24, textAlign: "center" },
  doneButton: { backgroundColor: "#1a1a1a", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12, borderWidth: 1, borderColor: "#333", marginTop: 24 },
  retryButton: { backgroundColor: "#7c3aed", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  doneButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
