import 'react-native-gesture-handler';
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';

import { auth } from '../src/lib/firebase';
import { useColors } from '../src/hooks/useColors';
import { useAppStore } from '../src/store/useAppStore';
import { useCartStore } from '../src/store/useCartStore';
import { subscribeCustomer, createCustomerProfile, getCustomer } from '../src/lib/customers';
import {
  subscribeSupermarkets,
  subscribeSupermarket,
  subscribeGondolas,
  subscribeProducts,
  subscribePromotions,
  subscribeDeliveryConfig,
  subscribeStoreInfo,
  subscribeAppConfig,
  subscribeStorefrontConfig,
} from '../src/lib/catalog';
import { subscribeMyOrders } from '../src/lib/orders';
import { customerStatus } from '../src/components/ui/Badge';
import { ensureNotificationPermissions, notifyOrderStatus } from '../src/lib/notifications';
import { startNetWatcher } from '../src/lib/net';

SplashScreen.preventAutoHideAsync().catch(() => {});

const STORE_KEY = '@nex_cliente_store_v1';

function RootNav() {
  const { colors } = useColors();
  const store = useAppStore();
  const {
    authUser,
    authReady,
    currentSmId,
    setAuthUser,
    setAuthReady,
    setCustomer,
    setCustomerLoaded,
    setSupermarkets,
    setSupermarket,
    setCurrentSmId,
    setGondolas,
    setProducts,
    setPromotions,
    setDeliveryConfig,
    setStoreInfo,
    setAppConfig,
    setStorefrontConfig,
    setMyOrders,
    resetStore,
  } = store;

  const hydrateCart = useCartStore((s) => s.hydrate);
  const prevStatuses = useRef<Record<string, string>>({});

  /* ---- bootstrap: cart + persisted store + auth listener ---- */
  useEffect(() => {
    hydrateCart();
    AsyncStorage.getItem(STORE_KEY).then((id) => {
      if (id) setCurrentSmId(id);
    });
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthUser(u ? { uid: u.uid, email: u.email, isAnonymous: u.isAnonymous } : null);
      setAuthReady(true);
    });
    ensureNotificationPermissions().catch(() => {});
    const stopNet = startNetWatcher();
    return () => {
      unsub();
      stopNet();
    };
  }, []);

  /* ---- persist the selected store ---- */
  useEffect(() => {
    if (currentSmId) AsyncStorage.setItem(STORE_KEY, currentSmId).catch(() => {});
  }, [currentSmId]);

  /* ---- supermarkets list (public) ---- */
  useEffect(() => {
    return subscribeSupermarkets(setSupermarkets);
  }, []);

  /* ---- customer profile (auth) ---- */
  useEffect(() => {
    if (!authUser || authUser.isAnonymous) {
      setCustomer(null);
      setCustomerLoaded(true);
      return;
    }
    setCustomerLoaded(false);
    const unsub = subscribeCustomer(authUser.uid, async (c) => {
      if (!c) {
        // First social / external login: seed a profile from the auth user.
        try {
          const existing = await getCustomer(authUser.uid);
          if (!existing) {
            await createCustomerProfile(authUser.uid, {
              name: auth.currentUser?.displayName || 'Cliente',
              email: auth.currentUser?.email || '',
              phone: auth.currentUser?.phoneNumber || '',
              photoUrl: auth.currentUser?.photoURL || '',
            });
          }
        } catch {}
      }
      setCustomer(c);
      setCustomerLoaded(true);
    });
    return unsub;
  }, [authUser?.uid]);

  /* ---- catalog for the selected store (real-time, RNF06) ---- */
  useEffect(() => {
    if (!currentSmId) {
      setSupermarket(null);
      setGondolas([]);
      setProducts([]);
      setPromotions([]);
      setDeliveryConfig(null);
      setStoreInfo(null);
      setAppConfig(null);
      setStorefrontConfig(null);
      return;
    }
    const unsubs = [
      subscribeSupermarket(currentSmId, setSupermarket),
      subscribeGondolas(currentSmId, setGondolas),
      subscribeProducts(currentSmId, setProducts),
      subscribePromotions(currentSmId, setPromotions),
      subscribeDeliveryConfig(currentSmId, setDeliveryConfig),
      subscribeStoreInfo(currentSmId, setStoreInfo),
      subscribeAppConfig(currentSmId, setAppConfig),
      subscribeStorefrontConfig(currentSmId, setStorefrontConfig),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [currentSmId]);

  /* ---- my orders (auth) + push on status change (RF22) ---- */
  useEffect(() => {
    if (!authUser) {
      setMyOrders([]);
      prevStatuses.current = {};
      return;
    }
    return subscribeMyOrders(authUser.uid, (orders) => {
      orders.forEach((o) => {
        const key = `${o.status}|${o.deliveryStatus || ''}`;
        const prev = prevStatuses.current[o.id];
        if (prev && prev !== key) {
          const s = customerStatus(o);
          notifyOrderStatus(
            `Pedido #${o.id.slice(0, 6).toUpperCase()}`,
            statusMessage(o, s.label),
          );
        }
        prevStatuses.current[o.id] = key;
      });
      setMyOrders(orders);
    });
  }, [authUser?.uid]);

  /* ---- sign-out cleanup ---- */
  useEffect(() => {
    if (authReady && !authUser) {
      setCustomer(null);
    }
  }, [authReady, authUser]);

  /* ---- hide splash when ready ---- */
  useEffect(() => {
    if (authReady) SplashScreen.hideAsync().catch(() => {});
  }, [authReady]);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="store-picker" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="category/[id]" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="chat/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="addresses" />
        <Stack.Screen name="address-edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="support" />
      </Stack>

      {!authReady ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : null}
    </>
  );
}

function statusMessage(order: any, label: string): string {
  switch (order.deliveryStatus) {
    case 'going_to_customer':
    case 'picked_up':
      return 'Seu pedido saiu para entrega! 🛵';
    case 'going_to_store':
    case 'arrived_store':
      return 'O entregador está na loja retirando seu pedido.';
    case 'delivered':
      return 'Pedido entregue. Bom apetite! 🎉';
  }
  switch (order.status) {
    case 'picking':
      return 'Estamos separando seus produtos. 🛒';
    case 'waiting_substitution':
      return 'Um item está em falta — toque para revisar a substituição.';
    case 'ready':
      return order.fulfillment === 'pickup' ? 'Seu pedido está pronto para retirada!' : 'Pedido pronto, aguardando o entregador.';
    case 'delivered':
      return 'Pedido concluído. 🎉';
    case 'cancelled':
      return 'Seu pedido foi cancelado.';
    default:
      return `Status atualizado: ${label}.`;
  }
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <RootNav />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
