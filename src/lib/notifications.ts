import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Show banners + play sound even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function ensureNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', {
      name: 'Atualizações de pedidos',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
      lightColor: '#58CC02',
      sound: 'default',
    });
  }
  return status === 'granted';
}

/**
 * Token Expo Push do dispositivo — anexado ao pedido para que loja/entregador
 * disparem notificações transacionais via servidor de pagamentos
 * (`POST /api/notifications/send`). Requer o projectId do EAS
 * (`eas build:configure`); sem ele retorna null e o app segue sem push remoto.
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const ok = await ensureNotificationPermissions();
    if (!ok) return null;
    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;
    if (!projectId) return null;
    const res = await Notifications.getExpoPushTokenAsync({ projectId });
    return res.data || null;
  } catch {
    return null;
  }
}

/** Fire a local notification for an order status change (RF22). */
export async function notifyOrderStatus(title: string, body: string, haptic = true) {
  if (haptic) {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // immediate
    });
  } catch (e) {
    console.warn('Failed to present notification', e);
  }
}

export async function notify(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default' },
      trigger: null,
    });
  } catch {}
}

export const tapHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

export const successHaptic = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

export const warnHaptic = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};
