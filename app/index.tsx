import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColors } from '../src/hooks/useColors';
import { useAppStore } from '../src/store/useAppStore';

const STORE_KEY = '@nex_cliente_store_v1';

/** Decides the initial screen: store picker (first run) or the home tabs. */
export default function Index() {
  const { colors } = useColors();
  const router = useRouter();
  const authReady = useAppStore((s) => s.authReady);
  const currentSmId = useAppStore((s) => s.currentSmId);
  const [checked, setChecked] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY).then((id) => setChecked(id));
  }, []);

  useEffect(() => {
    if (!authReady || checked === undefined) return;
    const storeId = currentSmId || checked;
    if (storeId) router.replace('/(tabs)');
    else router.replace('/store-picker');
  }, [authReady, checked, currentSmId]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
