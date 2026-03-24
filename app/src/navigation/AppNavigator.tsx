import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/HomeScreen";
import { PayScreen } from "../screens/PayScreen";
import { ReceiveScreen } from "../screens/ReceiveScreen";
import { SettleScreen } from "../screens/SettleScreen";
import { VaultScreen } from "../screens/VaultScreen";

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0a0a0a" },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Pay" component={PayScreen} />
        <Stack.Screen name="Receive" component={ReceiveScreen} />
        <Stack.Screen name="Settle" component={SettleScreen} />
        <Stack.Screen name="Vault" component={VaultScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
