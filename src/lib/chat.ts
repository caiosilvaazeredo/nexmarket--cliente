import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ChatMessage, ChatRole } from './types';

function messagesCol(smId: string, orderId: string) {
  return collection(db, `supermarkets/${smId}/orders/${orderId}/messages`);
}

export function subscribeMessages(
  smId: string,
  orderId: string,
  cb: (msgs: ChatMessage[]) => void,
) {
  const q = query(messagesCol(smId, orderId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }) as ChatMessage)),
    (err) => {
      console.warn('subscribeMessages error', err);
      cb([]);
    },
  );
}

export async function sendMessage(
  smId: string,
  orderId: string,
  msg: { text: string; senderId: string; senderRole?: ChatRole },
) {
  await addDoc(messagesCol(smId, orderId), {
    text: msg.text.trim(),
    senderId: msg.senderId,
    senderRole: msg.senderRole || 'customer',
    createdAt: serverTimestamp(),
  });
}
