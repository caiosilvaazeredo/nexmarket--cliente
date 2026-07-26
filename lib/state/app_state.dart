import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models.dart';
import '../services/catalog_repo.dart';
import '../services/customers_repo.dart';
import '../services/fire.dart';
import '../services/orders_repo.dart';

/// Estado global: autenticação, loja selecionada, catálogo em tempo real,
/// marca white-label e pedidos do cliente.
class AppState extends ChangeNotifier {
  User? user;
  CustomerProfile? profile;

  String? supermarketId;
  Supermarket? supermarket;
  AppConfig? appConfig;
  List<Gondola> gondolas = [];
  List<Product> products = [];
  List<Promotion> promotions = [];
  DeliveryConfig? deliveryConfig;
  StoreInfo? storeInfo;
  List<Order> orders = [];

  bool initialized = false;

  final _subs = <StreamSubscription>[];
  StreamSubscription? _profileSub;
  StreamSubscription? _ordersSub;

  AppState() {
    // Em teste (Firestore fake) não há FirebaseAuth real para assinar.
    if (Fire.isTestMode) return;
    Fire.auth.authStateChanges().listen((u) async {
      user = u;
      _profileSub?.cancel();
      _ordersSub?.cancel();
      profile = null;
      orders = [];
      if (u != null && !u.isAnonymous) {
        _profileSub = CustomersRepo.profile(u.uid).listen((p) {
          profile = p;
          if (supermarketId == null && p?.lastSupermarketId != null) {
            selectSupermarket(p!.lastSupermarketId!);
          }
          notifyListeners();
        });
        _ordersSub = OrdersRepo.myOrders(u.uid).listen((o) {
          orders = o;
          notifyListeners();
        });
      }
      if (!initialized) {
        final prefs = await SharedPreferences.getInstance();
        final saved = prefs.getString('supermarketId');
        if (saved != null && saved.isNotEmpty) selectSupermarket(saved);
        initialized = true;
      }
      notifyListeners();
    });
  }

  bool get isLoggedIn => user != null && !(user?.isAnonymous ?? true);
  bool get hasStore => supermarketId != null;

  /// Nome de exibição da loja (white-label — RNF01).
  String get storeName =>
      appConfig?.storeName?.isNotEmpty == true ? appConfig!.storeName! : (supermarket?.name ?? 'Nexmarket');

  /// Cor de destaque white-label (fallback: verde Nexmarket).
  Color get accentColor {
    final hex = appConfig?.accentColor ?? supermarket?.themeColor;
    if (hex != null && hex.startsWith('#') && (hex.length == 7 || hex.length == 9)) {
      final v = int.tryParse(hex.substring(1), radix: 16);
      if (v != null) return Color(hex.length == 7 ? 0xFF000000 | v : v);
    }
    return const Color(0xFF58CC02);
  }

  Future<void> selectSupermarket(String smId) async {
    if (supermarketId == smId) return;
    supermarketId = smId;
    for (final s in _subs) {
      s.cancel();
    }
    _subs.clear();
    // Zera o catálogo e a marca da loja anterior para não vazar nome/cor
    // antigos enquanto os novos snapshots não chegam.
    supermarket = null;
    gondolas = [];
    products = [];
    promotions = [];
    appConfig = null;
    deliveryConfig = null;
    storeInfo = null;
    notifyListeners();

    _subs.addAll([
      CatalogRepo.supermarket(smId).listen((s) {
        supermarket = s;
        notifyListeners();
      }),
      CatalogRepo.gondolas(smId).listen((g) {
        gondolas = g;
        notifyListeners();
      }),
      CatalogRepo.products(smId).listen((p) {
        products = p;
        notifyListeners();
      }),
      CatalogRepo.promotions(smId).listen((p) {
        promotions = p;
        notifyListeners();
      }),
      CatalogRepo.deliveryConfig(smId).listen((c) {
        deliveryConfig = c;
        notifyListeners();
      }),
      CatalogRepo.storeInfo(smId).listen((s) {
        storeInfo = s;
        notifyListeners();
      }),
      CatalogRepo.appConfig(smId).listen((c) {
        appConfig = c;
        notifyListeners();
      }),
    ]);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('supermarketId', smId);
    final uid = user?.uid;
    if (uid != null && isLoggedIn) {
      CustomersRepo.setLastSupermarket(uid, smId);
    }
    notifyListeners();
  }

  Product? productById(String id) {
    for (final p in products) {
      if (p.id == id) return p;
    }
    return null;
  }

  List<Product> productsInGondola(String gondolaId) =>
      products.where((p) => p.active && p.gondolaId == gondolaId).toList();

  List<Order> get activeOrders => orders.where((o) => o.isActive).toList();

  bool get isFirstOrder => orders.isEmpty;

  Future<void> signOut() => Fire.auth.signOut();

  @override
  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    _profileSub?.cancel();
    _ordersSub?.cancel();
    super.dispose();
  }
}
