import React, { useState } from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { ChevronDown, MessageCircle, Phone, HelpCircle } from 'lucide-react-native';

import { Screen } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { useColors } from '../src/hooks/useColors';
import { font, fontSize, spacing, radius } from '../src/lib/theme';
import { useStore } from '../src/store/useStore';

const FAQ = [
  { q: 'Como acompanho meu pedido?', a: 'Na aba Pedidos você vê o status em tempo real e, em entregas parceiras, a posição do entregador no mapa.' },
  { q: 'Quais formas de pagamento posso usar?', a: 'PIX, cartão online (tokenizado), cartão na entrega e dinheiro. Seus dados de cartão nunca são salvos por nós.' },
  { q: 'Posso agendar a entrega?', a: 'Sim, quando a loja permite. Escolha um horário na etapa de entrega do checkout.' },
  { q: 'Como uso um cupom?', a: 'No carrinho, digite o código no campo "Código promocional" e toque em Aplicar.' },
  { q: 'E se faltar um produto?', a: 'A loja pode sugerir uma substituição. Você recebe um aviso e decide aceitar ou recusar — com estorno proporcional se recusar.' },
  { q: 'Como peço reembolso ou cancelo?', a: 'Pedidos ainda não separados podem ser cancelados na tela do pedido. Para outros casos, fale com a loja pelo chat ou WhatsApp.' },
];

export default function Support() {
  const { colors } = useColors();
  const supermarket = useStore((s) => s.supermarket);
  const [open, setOpen] = useState<number | null>(0);

  const whatsapp = () => {
    const num = supermarket?.whatsapp;
    if (!num) return;
    Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent('Olá! Preciso de ajuda com um pedido.')}`);
  };

  return (
    <Screen title="Ajuda e suporte" subtitle={supermarket?.name}>
      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <HelpCircle size={22} color={colors.primary} />
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Fale com a gente</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>Precisa de ajuda agora? Escolha um canal:</Text>
        {supermarket?.whatsapp ? (
          <Button label="WhatsApp da loja" icon={<MessageCircle size={18} color="#FFFFFF" />} onPress={whatsapp} />
        ) : null}
        <Button label="Ligar para a loja" variant="secondary" icon={<Phone size={18} color={colors.textMuted} />} onPress={() => supermarket?.whatsapp && Linking.openURL(`tel:+${supermarket.whatsapp}`)} />
      </Card>

      <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, marginTop: spacing.sm }}>Perguntas frequentes</Text>
      {FAQ.map((item, i) => {
        const expanded = open === i;
        return (
          <Pressable key={i} onPress={() => setOpen(expanded ? null : i)} style={{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.lg, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, color: colors.text, fontWeight: font.bold }}>{item.q}</Text>
              <ChevronDown size={20} color={colors.textMuted} style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
            </View>
            {expanded && <Text style={{ color: colors.textMuted, fontWeight: font.medium, lineHeight: 21 }}>{item.a}</Text>}
          </Pressable>
        );
      })}
      <View style={{ height: 20 }} />
    </Screen>
  );
}
