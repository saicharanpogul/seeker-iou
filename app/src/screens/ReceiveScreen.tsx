import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface ReceiveScreenProps {
  navigation: any;
}

export function ReceiveScreen({ navigation }: ReceiveScreenProps) {
  const [status, setStatus] = useState<"waiting" | "received" | "error">("waiting");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [senderDomain, setSenderDomain] = useState("");
  const [trustScore, setTrustScore] = useState(1.0);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Receive Payment</Text>

      {status === "waiting" && (
        <View style={styles.waitingContainer}>
          <Text style={styles.waitingText}>
            Hold your phone near the sender's Seeker
          </Text>
          <Text style={styles.waitingEmoji}>📱</Text>
          <Text style={styles.waitingHint}>Waiting for NFC tap...</Text>
        </View>
      )}

      {status === "received" && (
        <View style={styles.receivedCard}>
          <Text style={styles.receivedLabel}>Incoming Payment</Text>
          <Text style={styles.receivedAmount}>{receivedAmount} USDC</Text>
          <Text style={styles.senderLabel}>
            From: {senderDomain || "unknown.skr"}
          </Text>

          <View style={styles.trustRow}>
            <Text style={styles.trustLabel}>Trust Score:</Text>
            <Text
              style={[
                styles.trustScore,
                {
                  color:
                    trustScore >= 0.95
                      ? "#059669"
                      : trustScore >= 0.8
                      ? "#d97706"
                      : "#dc2626",
                },
              ]}
            >
              {(trustScore * 100).toFixed(1)}%
            </Text>
          </View>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0a0a0a" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff", marginTop: 16, marginBottom: 32 },
  waitingContainer: { alignItems: "center", marginTop: 64 },
  waitingText: { color: "#ccc", fontSize: 16, textAlign: "center", marginBottom: 32 },
  waitingEmoji: { fontSize: 64, marginBottom: 16 },
  waitingHint: { color: "#666", fontSize: 14 },
  receivedCard: { backgroundColor: "#1a1a1a", borderRadius: 16, padding: 24 },
  receivedLabel: { fontSize: 12, color: "#888", textTransform: "uppercase", letterSpacing: 1 },
  receivedAmount: { fontSize: 36, fontWeight: "700", color: "#059669", marginTop: 8 },
  senderLabel: { fontSize: 14, color: "#ccc", marginTop: 12 },
  trustRow: { flexDirection: "row", alignItems: "center", marginTop: 16, gap: 8 },
  trustLabel: { fontSize: 14, color: "#888" },
  trustScore: { fontSize: 16, fontWeight: "700" },
  acceptButton: { backgroundColor: "#059669", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginTop: 24 },
  acceptButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
