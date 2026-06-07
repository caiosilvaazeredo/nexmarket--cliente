import React from 'react';
import { View, Text } from 'react-native';
import { Tabs } from 'expo-router';
import { House, Search, Receipt, User } from 'lucide-react-native';
import { useColors } from '../../src/hooks/useColors';
import { font } from '../../src/lib/theme';
import { useStore, selectCartCount } from '../../src/store/useStore';

export default function TabsLayout() {
  const { colors } = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 2,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontWeight: font.bold, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Buscar', tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }} />
      <Tabs.Screen name="orders" options={{ title: 'Pedidos', tabBarIcon: ({ color, size }) => <Receipt color={color} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil', tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
