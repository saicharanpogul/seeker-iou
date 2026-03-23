import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

interface HomeScreenProps {
  navigation: any;
}

export function HomeScreen({ navigation }: HomeScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>seeker-iou</Text>
      <Text style={styles.subtitle}>Offline payments for Seeker</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceAmount}>0.00 USDC</Text>
        <Text style={styles.bondLabel}>Bond: 0.00 USDC (30%)</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.payButton]}
          onPress={() => navigation.navigate("Pay")}
        >
          <Text style={styles.buttonText}>Pay</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.receiveButton]}
          onPress={() => navigation.navigate("Receive")}
        >
          <Text style={styles.buttonText}>Receive</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate("Vault")}
        >
          <Text style={styles.secondaryButtonText}>Manage Vault</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.navigate("Settle")}
        >
          <Text style={styles.secondaryButtonText}>Settle IOUs</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#0a0a0a",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginTop: 48,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
    marginBottom: 32,
  },
  balanceCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
  },
  balanceLabel: {
    fontSize: 12,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "700",
    color: "#fff",
    marginTop: 8,
  },
  bondLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  payButton: {
    backgroundColor: "#7c3aed",
  },
  receiveButton: {
    backgroundColor: "#059669",
  },
  secondaryButton: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButtonText: {
    color: "#ccc",
    fontSize: 14,
    fontWeight: "500",
  },
});
