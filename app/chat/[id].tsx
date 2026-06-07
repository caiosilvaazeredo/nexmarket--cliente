import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send } from 'lucide-react-native';

import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { formatTime } from '../../src/lib/format';
import { useStore } from '../../src/store/useStore';
import { subscribeMessages, sendMessage } from '../../src/lib/chat';
import type { ChatMessage } from '../../src/lib/types';

export default function Chat() {
  const { colors } = useColors();
  const router = useRouter();
  const { id, sm } = useLocalSearchParams<{ id: string; sm: string }>();
  const uid = useStore((s) => s.authUser?.uid) || '';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id || !sm) return;
    return subscribeMessages(sm, id, (m) => {
      setMessages(m);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    });
  }, [id, sm]);

  const send = async () => {
    if (!text.trim() || !sm || !id) return;
    const t = text.trim();
    setText('');
    await sendMessage(sm, id, { text: t, senderId: uid, senderRole: 'customer' });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 2, borderColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={24} color={colors.text} />
        </Pressable>
        <View>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Chat do pedido</Text>
          <Text style={{ color: colors.textMuted, fontWeight: font.medium, fontSize: fontSize.xs }}>#{(id || '').slice(-6).toUpperCase()}</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          renderItem={({ item }) => {
            const mine = item.senderRole === 'customer';
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: mine ? colors.primary : colors.card, borderWidth: mine ? 0 : 2, borderColor: colors.border, borderRadius: radius.lg, padding: 12 }}>
                {!mine && <Text style={{ color: colors.textSubtle, fontWeight: font.bold, fontSize: 10, marginBottom: 2, textTransform: 'capitalize' }}>{item.senderRole === 'store' ? 'Loja' : item.senderRole === 'driver' ? 'Entregador' : 'Suporte'}</Text>}
                <Text style={{ color: mine ? '#FFFFFF' : colors.text, fontWeight: font.medium }}>{item.text}</Text>
                <Text style={{ color: mine ? 'rgba(255,255,255,0.7)' : colors.textSubtle, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' }}>{formatTime(item.createdAt)}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={{ color: colors.textSubtle, textAlign: 'center', marginTop: 40, fontWeight: font.medium }}>Envie uma mensagem para a loja.</Text>}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderTopWidth: 2, borderColor: colors.border }}>
          <TextInput
            placeholder="Mensagem…"
            placeholderTextColor={colors.textSubtle}
            value={text}
            onChangeText={setText}
            style={{ flex: 1, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontWeight: font.medium }}
          />
          <Pressable onPress={send} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Send size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
