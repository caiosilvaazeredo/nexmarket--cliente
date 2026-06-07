import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useRouter, useSegments } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import * as SplashScreen from 'expo-splash-screen';

import { auth, loginAsVisitor } from '../src/lib/firebase';
import {
  subscribeCustomer,
  ensureCustomerProfile,
  subscribeAddresses,
  registerPushToken,
} from '../src/lib/customers';
import {
  resolveSupermarket,
  subscribeSupermarket,
  getDeliveryConfig,
  isDemoMode,
} from '../src/lib/catalog';
import { subscribeMyOrders } from '../src/lib/orders';
import { hydrateCart } from '../src/lib/cart';
import { useStore } from '../src/store/useStore';
import { useColors } from '../src/hooks/useColors';
import { startNetWatcher } from '../src/lib/net';
import {
  ensureNotificationPermissions,
  getPushToken,
  notifyOnStatusChange,
} from '../src/lib/notifications';
import { CartBar } from '../src/components/CartBar';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNav() {
  const { colors } = useColors();
  const router = useRouter();
  const segments = useSegments();

  const {
    authUser,
    authReady,
    customer,
    customerLoaded,
    supermarket,
    setAuthUser,
    setAuthReady,
    setCustomer,
    setCustomerLoaded,
    setSupermarket,
    setDeliveryConfig,
    setBranding,
    setAddresses,
    setOrders,
    orders,
  } = useStore();

  const [storeReady, setStoreReady] = useState(false);
  const orderSigs = useRef<Map<string, string>>(new Map());

  /* ---- auth: auto guest sign-in so the storefront is instantly browsable ---- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        // No session yet — sign in anonymously (guest mode). The user can
        // upgrade to a real account at checkout or from the profile.
        try {
          await loginAsVisitor();
          return; // onAuthStateChanged fires again with the anon user.
        } catch {
          setAuthUser(null);
          setAuthReady(true);
          return;
        }
      }
      setAuthUser({ uid: u.uid, email: u.email, isAnonymous: u.isAnonymous });
      setAuthReady(true);
    });
    ensureNotificationPermissions().catch(() => {});
    const stopNet = startNetWatcher();
    hydrateCart();
    return () => {
      unsub();
      stopNet();
    };
  }, []);

  /* ---- resolve the store + branding + delivery config (once) ---- */
  useEffect(() => {
    if (!authUser) return;
    let unsubStore: undefined | (() => void);
    (async () => {
      const sm = await resolveSupermarket();
      setSupermarket(sm);
      setBranding(sm.branding || null);
      setDeliveryConfig(await getDeliveryConfig(sm.id));
      setStoreReady(true);
      if (!isDemoMode()) {
        unsubStore = subscribeSupermarket(sm.id, (fresh) => {
          setSupermarket(fresh);
          setBranding(fresh.branding || null);
        });
      }
    })();
    return () => unsubStore?.();
  }, [authUser?.uid]);

  /* ---- customer profile ---- */
  useEffect(() => {
    if (!authUser) {
      setCustomer(null);
      setCustomerLoaded(true);
      return;
    }
    setCustomerLoaded(false);
    let unsub: undefined | (() => void);
    (async () => {
      // Make sure a profile document exists (guest or real).
      await ensureCustomerProfile(authUser.uid, {
        name: auth.currentUser?.displayName || (authUser.isAnonymous ? 'Visitante' : 'Cliente'),
        email: authUser.email || '',
        phone: auth.currentUser?.phoneNumber || '',
        photoUrl: auth.currentUser?.photoURL || '',
      }).catch(() => {});
      unsub = subscribeCustomer(authUser.uid, (c) => {
        setCustomer(c);
        setCustomerLoaded(true);
      });
      // Register a push token for order updates (RF22).
      getPushToken().then((t) => {
        if (t) registerPushToken(authUser.uid, t);
      });
    })();
    return () => unsub?.();
  }, [authUser?.uid]);

  /* ---- addresses ---- */
  useEffect(() => {
    if (!authUser) return;
    const unsub = subscribeAddresses(authUser.uid, setAddresses);
    return unsub;
  }, [authUser?.uid]);

  /* ---- my orders + push notifications on status change (RF20, RF22) ---- */
  useEffect(() => {
    if (!authUser) return;
    const unsub = subscribeMyOrders(authUser.uid, (list) => {
      list.forEach((o) => {
        const prev = orderSigs.current.get(o.id);
        const sig = notifyOnStatusChange(o, prev);
        orderSigs.current.set(o.id, sig);
      });
      setOrders(list);
    });
    return unsub;
  }, [authUser?.uid]);

  /* ---- hide splash when the first paint is ready ---- */
  useEffect(() => {
    if (authReady && storeReady) SplashScreen.hideAsync().catch(() => {});
  }, [authReady, storeReady]);

  const loading = !authReady || !storeReady || (!!authUser && !customerLoaded);

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="category/[id]" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="checkout" />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="address/index" />
        <Stack.Screen name="address/edit" options={{ presentation: 'modal' }} />
        <Stack.Screen name="rate/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="chat/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="support" options={{ presentation: 'modal' }} />
      </Stack>

      {!loading && <CartBar />}

      {loading && (
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
      )}
    </>
  );
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
