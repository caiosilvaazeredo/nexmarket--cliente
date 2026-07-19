import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

/// Identidade visual "Duolingo" da plataforma: verde vibrante, cantos
/// arredondados, botões grandes e tipografia forte (RNF02).
const kGreen = Color(0xFF58CC02);
const kGreenDark = Color(0xFF46A302);

ThemeData buildTheme(Color accent) {
  final scheme = ColorScheme.fromSeed(seedColor: accent, primary: accent);
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: const Color(0xFFF7F7F7),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: Colors.black87,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: const TextStyle(
        color: Colors.black87,
        fontSize: 20,
        fontWeight: FontWeight.w800,
      ),
      surfaceTintColor: Colors.white,
      iconTheme: IconThemeData(color: accent),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: accent,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: accent,
        minimumSize: const Size.fromHeight(52),
        side: BorderSide(color: accent, width: 2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE5E5E5)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE5E5E5), width: 2),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: accent, width: 2),
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE5E5E5), width: 1.5),
      ),
      margin: EdgeInsets.zero,
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}

final _currency = NumberFormat.currency(locale: 'pt_BR', symbol: 'R\$');

String money(num value) => _currency.format(value);

/// Rótulos PT-BR do ciclo de status do pedido.
const statusLabels = <String, String>{
  'pending': 'Recebido',
  'picking': 'Em separação',
  'waiting_substitution': 'Aguardando você',
  'ready': 'Pronto',
  'delivered': 'Entregue',
  'cancelled': 'Cancelado',
};

const deliveryStatusLabels = <String, String>{
  'awaiting_driver': 'Buscando entregador',
  'assigned': 'Entregador a caminho da loja',
  'going_to_store': 'Entregador a caminho da loja',
  'arrived_store': 'Entregador na loja',
  'picked_up': 'Pedido coletado',
  'going_to_customer': 'A caminho de você',
  'delivered': 'Entregue',
  'problem': 'Problema na entrega',
};

const paymentLabels = <String, String>{
  'pix': 'PIX',
  'card_online': 'Cartão (online)',
  'card_delivery': 'Cartão na entrega',
  'cash_delivery': 'Dinheiro',
  'voucher_delivery': 'Vale-alimentação',
};
