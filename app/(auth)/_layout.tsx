import React from 'react';
import { Stack } from 'expo-router';
import { useColors } from '../../src/hooks/useColors';

export default function AuthLayout() {
  const { colors } = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="recovery" />
      <Stack.Screen name="phone" />
    </Stack>
  );
}
