import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send, Store } from 'lucide-react-native';

import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { formatTime } from '../../src/lib/format';
import { useAppStore } from '../../src/store/useAppStore';
import { subscribeMessages, sendMessage } from '../../src/lib/chat';
import type { ChatMessage } from '../../src/lib/types';

const QUICK = ['Pode tocar a campainha?', 'Estou descendo', 'Deixe na portaria, por favor', 'Qual a previsão de entrega?'];

export default function Chat() {
  const { colors } = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; sm?: string }>();
  const authUser = useAppStore((s) => s.authUser);
  const brandName = useAppStore((s) => s.brand.name);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  const smId = params.sm || '';
  const orderId = params.id || '';

  useEffect(() => {
    if (!smId || !orderId) return;
    return subscribeMessages(smId, orderId, setMessages);
  }, [smId, orderId]);

  const send = async (msg?: string) => {
    const t = (msg ?? text).trim();
    if (!t || !authUser) return;
    if (!msg) setText('');
    try {
      await sendMessage(smId, orderId, { text: t, senderId: authUser.uid, senderRole: 'customer' });
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Store size={20} color={colors.primary} />
        </View>
        <View>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>{brandName}</Text>
          <Text style={{ color: colors.textMuted, fontWeight: font.medium, fontSize: fontSize.xs }}>
            Loja & entregador • #{orderId.slice(0, 6).toUpperCase()}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
              <Text style={{ color: colors.textSubtle, fontWeight: font.medium, textAlign: 'center' }}>
                Converse com a loja e o entregador sobre este pedido.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.senderRole === 'customer';
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                <View style={{ backgroundColor: mine ? colors.primary : colors.card, borderWidth: mine ? 0 : 2, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10 }}>
                  {!mine ? (
                    <Text style={{ color: colors.textMuted, fontWeight: font.bold, fontSize: 10, marginBottom: 2 }}>
                      {item.senderRole === 'store' ? 'Loja' : item.senderRole === 'support' ? 'Suporte' : 'Entregador'}
                    </Text>
                  ) : null}
                  <Text style={{ color: mine ? '#fff' : colors.text, fontWeight: font.medium, fontSize: fontSize.base }}>{item.text}</Text>
                </View>
                <Text style={{ color: colors.textSubtle, fontSize: 10, marginTop: 2, alignSelf: mine ? 'flex-end' : 'flex-start' }}>{formatTime(item.createdAt)}</Text>
              </View>
            );
          }}
        />

        {/* Quick replies */}
        {messages.length === 0 ? (
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {QUICK.map((q) => (
              <Pressable key={q} onPress={() => send(q)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.card }}>
                <Text style={{ color: colors.textMuted, fontWeight: font.semibold, fontSize: fontSize.xs }}>{q}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Escreva uma mensagem…"
            placeholderTextColor={colors.textSubtle}
            style={{ flex: 1, backgroundColor: colors.cardMuted, borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10, color: colors.text, fontWeight: font.medium, fontSize: fontSize.base }}
            onSubmitEditing={() => send()}
            returnKeyType="send"
          />
          <Pressable onPress={() => send()} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Send size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
