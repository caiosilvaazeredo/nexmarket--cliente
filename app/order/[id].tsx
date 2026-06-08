import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Modal, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  ArrowLeft,
  MessageCircle,
  Phone,
  ShoppingBag,
  Bike,
  Star,
  X,
  Check,
  AlertTriangle,
  QrCode,
  Copy,
  MapPin,
  Store,
  Package,
  ChevronRight,
  RotateCcw,
  Camera,
} from 'lucide-react-native';

import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { MapPanel, MapMarker } from '../../src/components/MapPanel';
import { OrderStatusTracker } from '../../src/components/OrderStatusTracker';
import { StarRating } from '../../src/components/StarRating';
import { useColors } from '../../src/hooks/useColors';
import { font, fontSize, radius, spacing, shadow } from '../../src/lib/theme';
import { brl, fullAddress, relativeTime } from '../../src/lib/format';
import { isValidGeo, regionFor, regionForBounds, openDirections } from '../../src/lib/geo';
import {
  subscribeOrder,
  subscribeDriverPublic,
  respondToSubstitutions,
  cancelOrder,
  markPaid,
  rateOrder,
  needsSubstitutionReview,
} from '../../src/lib/orders';
import { customerStatus } from '../../src/components/ui/Badge';
import { pickImage } from '../../src/lib/images';
import { successHaptic } from '../../src/lib/notifications';
import { PAYMENT_SHORT } from '../../src/lib/payments';
import { useReorder } from '../../src/hooks/useReorder';
import type { Order, PublicDriver } from '../../src/lib/types';

const RATING_PROBLEMS = ['Atraso', 'Produto danificado', 'Itens faltando', 'Atendimento do entregador', 'Embalagem'];

export default function OrderScreen() {
  const { colors } = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; sm?: string; new?: string; paid?: string; rate?: string }>();
  const smId = params.sm || '';
  const orderId = params.id || '';

  const [order, setOrder] = useState<Order | null>(null);
  const [driver, setDriver] = useState<PublicDriver | null>(null);
  const [showSub, setShowSub] = useState(false);
  const [showRate, setShowRate] = useState(params.rate === '1');
  const [showPix, setShowPix] = useState(false);
  const reorder = useReorder();

  useEffect(() => {
    if (!smId || !orderId) return;
    return subscribeOrder(smId, orderId, setOrder);
  }, [smId, orderId]);

  useEffect(() => {
    if (order?.driverId) return subscribeDriverPublic(order.driverId, setDriver);
    setDriver(null);
  }, [order?.driverId]);

  // Auto-open the substitution review when the store is waiting on the customer.
  useEffect(() => {
    if (order && needsSubstitutionReview(order)) setShowSub(true);
  }, [order?.status, order?.updatedAt]);

  if (!order) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <Package size={48} color={colors.textSubtle} />
        <Text style={{ color: colors.textMuted, fontWeight: font.bold }}>Carregando pedido…</Text>
        <Button label="Voltar" variant="ghost" fullWidth={false} onPress={() => router.replace('/(tabs)/orders')} />
      </SafeAreaView>
    );
  }

  const status = customerStatus(order);
  const finished = order.status === 'delivered' || order.deliveryStatus === 'delivered';
  const cancelled = order.status === 'cancelled';
  const isDelivery = order.fulfillment !== 'pickup';
  const canCancel = order.status === 'pending' && !cancelled && !finished;
  const paymentPending =
    (order.paymentMethod === 'pix' || order.paymentMethod === 'card_online') && order.paymentStatus !== 'paid' && !cancelled;

  // Live map: driver -> customer
  const driverLoc = order.driverLocation || driver?.location;
  const custLoc = order.deliveryAddress && isValidGeo(order.deliveryAddress) ? { lat: order.deliveryAddress.lat!, lng: order.deliveryAddress.lng! } : null;
  const markers: MapMarker[] = [];
  if (isValidGeo(driverLoc)) markers.push({ id: 'driver', lat: driverLoc!.lat, lng: driverLoc!.lng, title: driver?.name || 'Entregador', color: colors.primary });
  if (custLoc) markers.push({ id: 'cust', lat: custLoc.lat, lng: custLoc.lng, title: 'Você', color: colors.danger });
  if (isValidGeo(order.storeLocation) && !isValidGeo(driverLoc)) markers.push({ id: 'store', lat: order.storeLocation!.lat, lng: order.storeLocation!.lng, title: order.storeName, color: colors.accent });
  const region =
    isValidGeo(driverLoc) && custLoc
      ? regionForBounds(driverLoc!, custLoc)
      : custLoc
        ? regionFor(custLoc)
        : isValidGeo(order.storeLocation)
          ? regionFor({ lat: order.storeLocation!.lat, lng: order.storeLocation!.lng })
          : undefined;

  const showMap = isDelivery && !cancelled && (order.deliveryStatus === 'going_to_customer' || order.deliveryStatus === 'picked_up' || markers.length >= 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
        <Pressable onPress={() => (params.new ? router.replace('/(tabs)/orders') : router.back())} hitSlop={10} style={{ padding: 6 }}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontWeight: font.bold, fontSize: fontSize.xs }}>PEDIDO #{order.id.slice(0, 6).toUpperCase()}</Text>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{status.label}</Text>
        </View>
        <View style={{ backgroundColor: status.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full }}>
          <Text style={{ color: status.fg, fontWeight: font.black, fontSize: 10, textTransform: 'uppercase' }}>{status.label}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        {/* New order success */}
        {params.new && !cancelled ? (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Check size={20} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontWeight: font.bold, flex: 1 }}>Pedido recebido! Acompanhe o preparo em tempo real.</Text>
          </View>
        ) : null}

        {/* Payment pending (PIX expiration alternative flow) */}
        {paymentPending ? (
          <PaymentPending order={order} colors={colors} onPay={() => setShowPix(true)} onMarkPaid={() => markPaid(order)} />
        ) : null}

        {/* Substitution alert */}
        {needsSubstitutionReview(order) ? (
          <Pressable onPress={() => setShowSub(true)} style={{ backgroundColor: colors.amberSoft, borderRadius: radius.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: colors.amber }}>
            <AlertTriangle size={22} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#92400E', fontWeight: font.black }}>Um item precisa da sua atenção</Text>
              <Text style={{ color: '#92400E', fontSize: fontSize.sm }}>A loja sugeriu uma substituição. Toque para revisar.</Text>
            </View>
            <ChevronRight size={20} color="#92400E" />
          </Pressable>
        ) : null}

        {/* Map */}
        {showMap ? (
          <View style={{ gap: spacing.sm }}>
            <MapPanel region={region} markers={markers} height={220} />
            {isValidGeo(driverLoc) && custLoc ? (
              <Button label="Ver rota no mapa" variant="secondary" icon={<MapPin size={18} color={colors.text} />} onPress={() => openDirections(custLoc, 'Entrega')} />
            ) : null}
          </View>
        ) : null}

        {/* Driver card */}
        {driver && !cancelled && !finished && isDelivery ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {driver.photoUrl ? <Image source={{ uri: driver.photoUrl }} style={{ width: '100%', height: '100%' }} /> : <Bike size={24} color={colors.primary} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.base }}>{driver.name || 'Entregador'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Star size={13} color={colors.amber} fill={colors.amber} />
                <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>{(driver.rating || 5).toFixed(1)} • {driver.vehicle?.model || driver.vehicle?.type || 'Moto'}</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push(`/chat/${order.id}?sm=${order.supermarketId}`)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={22} color={colors.primary} />
            </Pressable>
          </Card>
        ) : null}

        {/* Status tracker */}
        <Card>
          <OrderStatusTracker order={order} />
        </Card>

        {/* Cancelled / problem messaging */}
        {cancelled ? (
          <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.lg, padding: spacing.md, gap: 4 }}>
            <Text style={{ color: colors.danger, fontWeight: font.black }}>Pedido cancelado</Text>
            <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>
              {order.paymentStatus === 'paid' ? 'O estorno será processado para a forma de pagamento original.' : 'Nenhuma cobrança foi efetuada.'}
            </Text>
          </View>
        ) : null}

        {/* Delivery / pickup info */}
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {isDelivery ? <MapPin size={18} color={colors.primary} /> : <Store size={18} color={colors.primary} />}
            <Text style={{ color: colors.text, fontWeight: font.black }}>{isDelivery ? 'Entrega' : 'Retirada'}</Text>
          </View>
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {isDelivery ? fullAddress(order.deliveryAddress) : order.storeName}
          </Text>
          {order.scheduledFor ? <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs }}>Agendado</Text> : null}
        </Card>

        {/* Items */}
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={18} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: font.black }}>{order.items?.length || 0} itens</Text>
          </View>
          {order.items?.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: it.missing && !it.substituted ? colors.textSubtle : colors.text, fontWeight: font.medium, textDecorationLine: it.missing && !it.substituted ? 'line-through' : 'none' }}>
                  {it.quantity}x {it.name}
                </Text>
                {it.substituted ? <Text style={{ color: colors.amber, fontSize: fontSize.xs, fontWeight: font.bold }}>↳ {it.substituteName}</Text> : null}
                {it.missing && !it.substituted ? <Text style={{ color: colors.danger, fontSize: fontSize.xs, fontWeight: font.bold }}>Indisponível</Text> : null}
              </View>
              <Text style={{ color: colors.textMuted, fontWeight: font.semibold }}>{brl((it.substituted && it.substitutePrice ? it.substitutePrice : it.price) * it.quantity)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
          <Row label="Subtotal" value={brl(order.subtotal ?? order.total)} colors={colors} />
          {order.discount ? <Row label="Desconto" value={`- ${brl(order.discount)}`} colors={colors} /> : null}
          {isDelivery ? <Row label="Frete" value={order.deliveryFee ? brl(order.deliveryFee) : 'Grátis'} colors={colors} /> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={{ color: colors.text, fontWeight: font.black }}>Total</Text>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg }}>{brl(order.total)}</Text>
          </View>
          <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs }}>{paymentLabel(order.paymentMethod)} {order.paymentStatus === 'paid' ? '• Pago' : ''}</Text>
        </Card>

        {/* Communication */}
        {!cancelled ? (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Button label="Falar com a loja" variant="secondary" style={{ flex: 1 }} icon={<MessageCircle size={18} color={colors.text} />} onPress={() => router.push(`/chat/${order.id}?sm=${order.supermarketId}`)} />
            <Button label="Suporte" variant="secondary" style={{ flex: 1 }} icon={<Phone size={18} color={colors.text} />} onPress={() => router.push('/support')} />
          </View>
        ) : null}

        {/* Rating (delivered) */}
        {finished && !order.rating ? (
          <Button label="Avaliar pedido" icon={<Star size={18} color="#fff" />} onPress={() => setShowRate(true)} />
        ) : order.rating ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontWeight: font.bold }}>Sua avaliação</Text>
            <StarRating value={order.rating} readOnly size={20} />
          </Card>
        ) : null}

        {/* Repeat / cancel */}
        {finished ? (
          <Button label="Pedir novamente" variant="secondary" icon={<RotateCcw size={18} color={colors.text} />} onPress={() => reorder(order)} />
        ) : null}
        {canCancel ? (
          <Button
            label="Cancelar pedido"
            variant="ghost"
            textStyle={{ color: colors.danger }}
            onPress={() =>
              Alert.alert('Cancelar pedido', 'Tem certeza que deseja cancelar este pedido?', [
                { text: 'Não', style: 'cancel' },
                { text: 'Sim, cancelar', style: 'destructive', onPress: () => cancelOrder(order).catch(() => Alert.alert('Erro', 'Não foi possível cancelar.')) },
              ])
            }
          />
        ) : null}
      </ScrollView>

      {/* Substitution modal */}
      <SubstitutionModal visible={showSub} order={order} colors={colors} onClose={() => setShowSub(false)} />

      {/* Rating modal */}
      <RatingModal visible={showRate} order={order} colors={colors} onClose={() => setShowRate(false)} />

      {/* PIX modal */}
      <PixModal visible={showPix} order={order} colors={colors} onClose={() => setShowPix(false)} />
    </SafeAreaView>
  );
}

/* --------------------------- Payment pending --------------------------- */

function PaymentPending({ order, colors, onPay, onMarkPaid }: { order: Order; colors: any; onPay: () => void; onMarkPaid: () => void }) {
  const [left, setLeft] = useState(15 * 60);
  useEffect(() => {
    const created = order.createdAt?.toMillis?.() || order.createdAt?.seconds * 1000 || Date.now();
    const tick = () => setLeft(Math.max(0, Math.round((created + 15 * 60 * 1000 - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order.createdAt]);

  const expired = left <= 0;
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');

  return (
    <View style={{ backgroundColor: expired ? colors.dangerSoft : colors.amberSoft, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 2, borderColor: expired ? colors.danger : colors.amber }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <QrCode size={20} color={expired ? colors.danger : '#92400E'} />
        <Text style={{ color: expired ? colors.danger : '#92400E', fontWeight: font.black, flex: 1 }}>
          {expired ? 'Pagamento expirado' : `Pagamento pendente • expira em ${mm}:${ss}`}
        </Text>
      </View>
      <Text style={{ color: expired ? colors.danger : '#92400E', fontSize: fontSize.sm }}>
        {expired ? 'O tempo para pagamento acabou. Você pode tentar pagar novamente.' : 'Finalize o pagamento para que a loja inicie a separação do seu pedido.'}
      </Text>
      <Button label={expired ? 'Tentar pagar novamente' : order.paymentMethod === 'pix' ? 'Pagar com PIX' : 'Pagar agora'} onPress={onPay} />
    </View>
  );
}

/* --------------------------- Substitution modal --------------------------- */

function SubstitutionModal({ visible, order, colors, onClose }: { visible: boolean; order: Order; colors: any; onClose: () => void }) {
  const router = useRouter();
  const [decisions, setDecisions] = useState<Record<number, 'accepted' | 'rejected'>>({});
  const [busy, setBusy] = useState(false);

  const pendingItems = order.items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => (it.missing || it.substituted) && (!it.customerDecision || it.customerDecision === 'pending'));

  const allDecided = pendingItems.every(({ idx }) => decisions[idx]);

  const confirm = async () => {
    setBusy(true);
    try {
      await respondToSubstitutions(order, decisions);
      successHaptic();
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar sua resposta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], maxHeight: '88%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>Revisar substituições</Text>
            <Pressable onPress={onClose} hitSlop={10}><X size={24} color={colors.textMuted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <Text style={{ color: colors.textMuted }}>
              Alguns itens estavam em falta na prateleira. Aceite a sugestão da loja ou recuse para receber o estorno proporcional.
            </Text>
            {pendingItems.map(({ it, idx }) => (
              <View key={idx} style={{ borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, padding: spacing.md, gap: spacing.sm }}>
                <Text style={{ color: colors.textMuted, fontWeight: font.bold, fontSize: fontSize.xs, textTransform: 'uppercase' }}>Item em falta</Text>
                <Text style={{ color: colors.text, fontWeight: font.bold, textDecorationLine: 'line-through' }}>{it.quantity}x {it.name}</Text>
                {it.substituted ? (
                  <View style={{ backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: spacing.sm }}>
                    <Text style={{ color: '#92400E', fontWeight: font.bold, fontSize: fontSize.xs }}>SUBSTITUIR POR</Text>
                    <Text style={{ color: '#92400E', fontWeight: font.black }}>{it.substituteName}</Text>
                    <Text style={{ color: '#92400E' }}>{brl(it.substitutePrice || 0)}</Text>
                  </View>
                ) : (
                  <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>Sem sugestão de substituto. Aceitar = remover e estornar.</Text>
                )}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable onPress={() => setDecisions((d) => ({ ...d, [idx]: 'accepted' }))} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 2, borderColor: decisions[idx] === 'accepted' ? colors.primary : colors.border, backgroundColor: decisions[idx] === 'accepted' ? colors.primarySoft : colors.card }}>
                    <Check size={16} color={decisions[idx] === 'accepted' ? colors.primary : colors.textMuted} />
                    <Text style={{ color: decisions[idx] === 'accepted' ? colors.primary : colors.textMuted, fontWeight: font.bold }}>{it.substituted ? 'Aceitar' : 'Remover'}</Text>
                  </Pressable>
                  <Pressable onPress={() => setDecisions((d) => ({ ...d, [idx]: 'rejected' }))} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.md, borderWidth: 2, borderColor: decisions[idx] === 'rejected' ? colors.danger : colors.border, backgroundColor: decisions[idx] === 'rejected' ? colors.dangerSoft : colors.card }}>
                    <X size={16} color={decisions[idx] === 'rejected' ? colors.danger : colors.textMuted} />
                    <Text style={{ color: decisions[idx] === 'rejected' ? colors.danger : colors.textMuted, fontWeight: font.bold }}>Recusar</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Button label="Confirmar respostas" size="lg" loading={busy} disabled={!allDecided} onPress={confirm} />
            <Text style={{ color: colors.textSubtle, fontSize: fontSize.xs, textAlign: 'center' }}>
              Se você não responder a tempo, a loja pode remover o item automaticamente para não atrasar sua entrega.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* --------------------------- Rating modal --------------------------- */

function RatingModal({ visible, order, colors, onClose }: { visible: boolean; order: Order; colors: any; onClose: () => void }) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lowScore = stars > 0 && stars <= 3;
  const needsPhoto = tags.includes('Produto danificado');

  const submit = async () => {
    setBusy(true);
    try {
      await rateOrder(order, { rating: stars, comment, tags, photoUrl: photo || undefined });
      successHaptic();
      onClose();
      Alert.alert('Obrigado!', 'Sua avaliação ajuda a loja a melhorar.');
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar a avaliação.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], maxHeight: '88%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>Avaliar pedido</Text>
            <Pressable onPress={onClose} hitSlop={10}><X size={24} color={colors.textMuted} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: colors.text, fontWeight: font.bold, textAlign: 'center' }}>Como foi sua compra em {order.storeName}?</Text>
            <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
              <StarRating value={stars} onChange={setStars} size={44} />
            </View>

            {lowScore ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.text, fontWeight: font.bold }}>O que deu errado?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {RATING_PROBLEMS.map((p) => {
                    const active = tags.includes(p);
                    return (
                      <Pressable key={p} onPress={() => setTags((t) => (active ? t.filter((x) => x !== p) : [...t, p]))} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.full, borderWidth: 2, borderColor: active ? colors.danger : colors.border, backgroundColor: active ? colors.dangerSoft : colors.card }}>
                        <Text style={{ color: active ? colors.danger : colors.textMuted, fontWeight: font.bold, fontSize: fontSize.sm }}>{p}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {needsPhoto ? (
              photo ? (
                <View>
                  <Image source={{ uri: photo }} style={{ width: '100%', height: 160, borderRadius: radius.lg }} />
                  <Button label="Trocar foto" variant="ghost" onPress={async () => setPhoto(await pickImage({ camera: true }))} />
                </View>
              ) : (
                <Button label="Anexar foto do problema" variant="secondary" icon={<Camera size={18} color={colors.text} />} onPress={async () => setPhoto(await pickImage({ camera: true }))} />
              )
            ) : null}

            <Input placeholder="Conte mais para a loja (opcional)" value={comment} onChangeText={setComment} multiline style={{ height: 80, textAlignVertical: 'top' }} />
            <Button label="Enviar avaliação" size="lg" loading={busy} disabled={stars === 0 || (needsPhoto && !photo)} onPress={submit} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/* --------------------------- PIX modal --------------------------- */

function PixModal({ visible, order, colors, onClose }: { visible: boolean; order: Order; colors: any; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const pixCode = `00020126BR.GOV.BCB.PIX${order.id}520400005303986540${Math.round(order.total * 100)}5802BR6009NEXMARKET6304NEX1`;
  const isPix = order.paymentMethod === 'pix';

  const confirm = async () => {
    setBusy(true);
    try {
      await markPaid(order);
      onClose();
      Alert.alert('Pagamento confirmado', 'Recebemos seu pagamento. A loja já pode separar seu pedido!');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.card, borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'], padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.xl }}>{isPix ? 'Pague com PIX' : 'Pagamento online'}</Text>
          {isPix ? (
            <>
              <View style={{ alignSelf: 'center', width: 170, height: 170, borderRadius: radius.lg, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <QrCode size={110} color="#0F172A" />
              </View>
              <Pressable onPress={async () => { await Clipboard.setStringAsync(pixCode); Alert.alert('Copiado!', 'Código PIX copiado.'); }} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, padding: spacing.md }}>
                <Copy size={18} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: font.bold }}>Copiar código PIX</Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ color: colors.textMuted }}>Pagamento processado com segurança pela provedora. Não armazenamos os dados do cartão.</Text>
          )}
          <Text style={{ color: colors.text, fontWeight: font.black, fontSize: fontSize.lg, textAlign: 'center' }}>{brl(order.total)}</Text>
          <Button label="Já fiz o pagamento" size="lg" loading={busy} onPress={confirm} />
          <Button label="Fechar" variant="ghost" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/* --------------------------- helpers --------------------------- */

function paymentLabel(m?: string): string {
  return m && (PAYMENT_SHORT as any)[m] ? (PAYMENT_SHORT as any)[m] : 'Pagamento';
}

function Row({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.textMuted, fontWeight: font.medium }}>{label}</Text>
      <Text style={{ color: colors.textMuted, fontWeight: font.bold }}>{value}</Text>
    </View>
  );
}
