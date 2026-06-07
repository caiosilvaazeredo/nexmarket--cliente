import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface NetState {
  isOnline: boolean;
  setOnline: (v: boolean) => void;
}

export const useNet = create<NetState>((set) => ({
  isOnline: true,
  setOnline: (v) => set({ isOnline: v }),
}));

let started = false;

/** Start listening to connectivity changes. Returns an unsubscribe fn. */
export function startNetWatcher(onReconnect?: () => void) {
  if (started) return () => {};
  started = true;
  let wasOffline = false;

  const unsub = NetInfo.addEventListener((state) => {
    const online = !!state.isConnected && state.isInternetReachable !== false;
    useNet.getState().setOnline(online);
    if (online && wasOffline) {
      wasOffline = false;
      onReconnect?.();
    }
    if (!online) wasOffline = true;
  });

  return () => {
    unsub();
    started = false;
  };
}

export const isOnline = () => useNet.getState().isOnline;
