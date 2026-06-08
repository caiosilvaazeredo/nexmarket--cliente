import React, { useState } from 'react';
import { View, Text, Pressable, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronUp, MessageCircle, HelpCircle, Mail } from 'lucide-react-native';

import { Screen } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { useColors } from '../src/hooks/useColors';
import { font, fontSize, radius, spacing } from '../src/lib/theme';
import { useAppStore, selectActiveOrders } from '../src/store/useAppStore';

const FAQ = [
  {
    q: 'Como acompanho meu pedido?',
    a: 'Na aba Pedidos você vê o status em tempo real: aguardando, em separação, pronto/enviado, a caminho e entregue. Em entregas com parceiro, você acompanha o entregador no mapa.',
  },
  {
    q: 'O que acontece se um produto estiver em falta?',
    a: 'A loja pode sugerir um item substituto. Você recebe uma notificação para aceitar ou recusar. Se recusar, o valor do item é estornado proporcionalmente.',
  },
  {
    q: 'Quais formas de pagamento posso usar?',
    a: 'Depende da loja: PIX, cartão online, cartão na entrega, dinheiro (com troco) e vales-refeição. Você escolhe na tela de pagamento.',
  },
  {
    q: 'Como funciona o frete grátis?',
    a: 'Algumas lojas oferecem frete grátis acima de um valor mínimo. O app mostra quanto falta para liberar o frete grátis no carrinho.',
  },
  {
    q: 'Posso agendar minha entrega?',
    a: 'Sim, quando a loja permite. No checkout escolha "Assim que possível" ou um horário específico.',
  },
  {
    q: 'Como cancelo um pedido?',
    a: 'Enquanto o pedido estiver como "Aguardando" você pode cancelar pela tela do pedido. Após o início da separação, fale com a loja pelo chat.',
  },
  {
    q: 'Como excluo minha conta e meus dados?',
    a: 'Em Perfil > Excluir minha conta. Seus dados pessoais são removidos conforme a LGPD.',
  },
];

export default function Support() {
  const { colors } = useColors();
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(0);
  const activeOrders = useAppStore(selectActiveOrders);
  const brandName = useAppStore((s) => s.brand.name);

  const openWhatsApp = async () => {
    const text = encodeURIComponent(`Olá! Preciso de ajuda com um pedido no ${brandName}.`);
    const url = `whatsapp://send?text=${text}`;
    const web = `https://wa.me/?text=${text}`;
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else await Linking.openURL(web);
    } catch {
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp.');
    }
  };

  const chatStore = () => {
    if (activeOrders.length) {
      const o = activeOrders[0];
      router.push(`/chat/${o.id}?sm=${o.supermarketId}`);
    } else {
      Alert.alert('Chat', 'O chat fica disponível quando você tem um pedido em andamento.');
    }
  };

  return (
    <Screen
      title="Ajuda e suporte"
      subtitle="Estamos aqui para ajudar"
      left={<Button variant="ghost" fullWidth={false} icon={<ArrowLeft size={24} color={colors.text} />} onPress={() => router.back()} />}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Button label="Falar com a loja" style={{ flex: 1 }} icon={<MessageCircle size={18} color="#fff" />} onPress={chatStore} />
        <Button label="WhatsApp" variant="secondary" style={{ flex: 1 }} icon={<MessageCircle size={18} color={colors.primary} />} onPress={openWhatsApp} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm }}>
        <HelpCircle size={20} color={colors.primary} />
        <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>Perguntas frequentes</Text>
      </View>

      {FAQ.map((item, i) => {
        const expanded = open === i;
        return (
          <Card key={i} style={{ padding: 0 }}>
            <Pressable onPress={() => setOpen(expanded ? null : i)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md }}>
              <Text style={{ flex: 1, color: colors.text, fontWeight: font.bold, fontSize: fontSize.base }}>{item.q}</Text>
              {expanded ? <ChevronUp size={20} color={colors.textMuted} /> : <ChevronDown size={20} color={colors.textMuted} />}
            </Pressable>
            {expanded ? (
              <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 21 }}>{item.a}</Text>
              </View>
            ) : null}
          </Card>
        );
      })}

      <Button label="Enviar e-mail ao suporte" variant="secondary" icon={<Mail size={18} color={colors.text} />} onPress={() => Linking.openURL('mailto:suporte@nexmarket.app?subject=Ajuda%20Nexmarket')} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}
