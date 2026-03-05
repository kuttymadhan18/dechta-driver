import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      {/* This hides the top header bar for all screens */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register" options={{ headerShown: false }} />
      <Stack.Screen name="verify" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

    </Stack>
  );
}