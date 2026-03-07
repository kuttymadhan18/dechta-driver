import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { AuthAPI } from "../services/api";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const loggedIn = await AuthAPI.isLoggedIn();
        const inAuth =
          segments[0] === "login" ||
          segments[0] === "verify" ||
          segments[0] === "register";

        if (!loggedIn && !inAuth) {
          router.replace("/login");
        }
      } catch (e) {
        router.replace("/login");
      } finally {
        setChecked(true);
      }
    })();
  }, []);

  if (!checked) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#ffffff" }}>
        <ActivityIndicator size="large" color="#0284c7" />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="verify" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
