import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { isDemoMode } from './catalog';
import type { ChatMessage, ChatRole } from './types';

/**
 * Order chat (RF24) — shared with the store & driver apps at
 * /supermarkets/{smId}/orders/{orderId}/messages.
 */

function messagesCol(smId: string, orderId: string) {
  return collection(db, `supermarkets/${smId}/orders/${orderId}/messages`);
}

const demoThreads = new Map<string, ChatMessage[]>();
const demoSubs = new Map<string, ((m: ChatMessage[]) => void)[]>();

export function subscribeMessages(
  smId: string,
  orderId: string,
  cb: (msgs: ChatMessage[]) => void,
) {
  if (isDemoMode()) {
    const key = `${smId}/${orderId}`;
    const subs = demoSubs.get(key) || [];
    subs.push(cb);
    demoSubs.set(key, subs);
    cb(demoThreads.get(key) || []);
    return () => demoSubs.set(key, (demoSubs.get(key) || []).filter((s) => s !== cb));
  }
  const q = query(messagesCol(smId, orderId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as ChatMessage))),
    (err) => {
      console.warn('subscribeMessages error', err);
      cb([]);
    },
  );
}

export async function sendMessage(
  smId: string,
  orderId: string,
  msg: { text: string; senderId: string; senderRole: ChatRole },
) {
  if (isDemoMode()) {
    const key = `${smId}/${orderId}`;
    const list = demoThreads.get(key) || [];
    const next = [
      ...list,
      { id: `${Date.now()}`, text: msg.text.trim(), senderId: msg.senderId, senderRole: msg.senderRole, createdAt: Date.now() },
    ];
    demoThreads.set(key, next);
    (demoSubs.get(key) || []).forEach((s) => s(next));
    // Auto-reply from "store" so the demo chat feels alive.
    setTimeout(() => {
      const cur = demoThreads.get(key) || [];
      const reply = [...cur, { id: `${Date.now()}r`, text: 'Olá! Recebemos sua mensagem e já estamos cuidando do seu pedido. 😊', senderId: 'store', senderRole: 'store' as ChatRole, createdAt: Date.now() }];
      demoThreads.set(key, reply);
      (demoSubs.get(key) || []).forEach((s) => s(reply));
    }, 1500);
    return;
  }
  await addDoc(messagesCol(smId, orderId), {
    text: msg.text.trim(),
    senderId: msg.senderId,
    senderRole: msg.senderRole,
    createdAt: serverTimestamp(),
  });
}
