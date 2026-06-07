import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen } from '../../src/components/ui/Screen';
import { Button } from '../../src/components/ui/Button';
import { RatingStars } from '../../src/components/RatingStars';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../../src/lib/theme';
import { useStore } from '../../src/store/useStore';
import { rateOrder } from '../../src/lib/orders';
import { toast } from '../../src/components/ProductCard';

const LOW_REASONS = ['Atraso na entrega', 'Produto danificado', 'Itens faltando', 'Atendimento do entregador', 'Qualidade do produto'];

export default function RateOrder() {
  const { colors } = useColors();
  const router = useRouter();
  const { id, sm } = useLocalSearchParams<{ id: string; sm: string }>();
  const order = useStore((s) => s.orders.find((o) => o.id === id));

  const [productRating, setProductRating] = useState(0);
  const [deliveryRating, setDeliveryRating] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const low = (productRating > 0 && productRating <= 3) || (deliveryRating > 0 && deliveryRating <= 3);
  const toggleReason = (r: string) => setReasons((c) => (c.includes(r) ? c.filter((x) => x !== r) : [...c, r]));

  const submit = async () => {
    if (!order) return;
    if (productRating === 0) {
      toast('Dê uma nota aos produtos.');
      return;
    }
    setSaving(true);
    try {
      const fullComment = [reasons.length ? `Motivos: ${reasons.join(', ')}` : '', comment.trim()].filter(Boolean).join(' — ');
      await rateOrder(order, productRating, deliveryRating || productRating, fullComment);
      toast('Obrigado pela avaliação! ⭐');
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="Avaliar pedido" subtitle={order?.storeName}>
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Como foi sua compra?</Text>
        <RatingStars value={productRating} onChange={setProductRating} size={40} />
      </View>

      {order?.deliveryMethod === 'delivery' && (
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>E a entrega?</Text>
          <RatingStars value={deliveryRating} onChange={setDeliveryRating} size={36} />
        </View>
      )}

      {low && (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: font.bold }}>O que deu errado?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {LOW_REASONS.map((r) => {
              const active = reasons.includes(r);
              return (
                <Pressable key={r} onPress={() => toggleReason(r)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full, borderWidth: 2, borderColor: active ? colors.danger : colors.border, backgroundColor: active ? colors.dangerSoft : colors.card }}>
                  <Text style={{ color: active ? colors.danger : colors.textMuted, fontWeight: font.bold, fontSize: fontSize.sm }}>{r}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontWeight: font.bold }}>Comentário (opcional)</Text>
        <TextInput
          placeholder="Conte como foi sua experiência…"
          placeholderTextColor={colors.textSubtle}
          value={comment}
          onChangeText={setComment}
          multiline
          style={{ minHeight: 100, textAlignVertical: 'top', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, padding: 14, color: colors.text, fontWeight: font.medium, fontSize: fontSize.base }}
        />
      </View>

      <Button label="Enviar avaliação" size="lg" loading={saving} onPress={submit} />
      <Button label="Agora não" variant="ghost" textStyle={{ color: colors.textMuted }} onPress={() => router.back()} />
    </Screen>
  );
}
