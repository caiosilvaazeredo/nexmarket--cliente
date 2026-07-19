/// Modelo de dados compartilhado. Espelha o schema Firestore usado pelos
/// apps da loja e do entregador para que os três leiam/escrevam o MESMO banco.
///
/// Coleções relevantes para o cliente:
///   /supermarkets/{smId}                          -> Supermarket (leitura)
///   /supermarkets/{smId}/gondolas/{id}            -> Gondola (leitura)
///   /supermarkets/{smId}/products/{id}            -> Product (leitura)
///   /supermarkets/{smId}/promotions/{id}          -> Promotion (leitura)
///   /supermarkets/{smId}/deliveryConfig/main      -> DeliveryConfig (leitura)
///   /supermarkets/{smId}/settings/storeInfo       -> StoreInfo (leitura)
///   /supermarkets/{smId}/storefront/appConfig     -> AppConfig (leitura)
///   /supermarkets/{smId}/orders/{id}              -> Order (cria + lê os próprios)
///   /supermarkets/{smId}/orders/{id}/messages     -> ChatMessage
///   /customers/{uid}                              -> CustomerProfile
///   /drivers/{uid}                                -> PublicDriver (rastreio)
library;

double _d(dynamic v, [double fallback = 0]) {
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? fallback;
  return fallback;
}

int? _i(dynamic v) {
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v);
  return null;
}

String _s(dynamic v, [String fallback = '']) => v is String ? v : fallback;

/// Converte Timestamp/num/ISO em millis (0 quando ausente).
int tsMillis(dynamic ts) {
  if (ts == null) return 0;
  if (ts is num) return ts.toInt();
  try {
    // Timestamp do Firestore
    final ms = (ts as dynamic).millisecondsSinceEpoch;
    if (ms is int) return ms;
  } catch (_) {}
  if (ts is String) return DateTime.tryParse(ts)?.millisecondsSinceEpoch ?? 0;
  return 0;
}

/* --------------------------- Catálogo --------------------------- */

class Supermarket {
  final String id;
  final String name;
  final String? themeColor;
  final String? logoUrl;

  Supermarket({required this.id, required this.name, this.themeColor, this.logoUrl});

  factory Supermarket.fromMap(String id, Map<String, dynamic> m) => Supermarket(
        id: id,
        name: _s(m['name'], 'Loja'),
        themeColor: m['themeColor'] as String?,
        logoUrl: m['logoUrl'] as String?,
      );
}

class Gondola {
  final String id;
  final String name;
  final String? iconName;
  final int order;

  Gondola({required this.id, required this.name, this.iconName, this.order = 0});

  factory Gondola.fromMap(String id, Map<String, dynamic> m) => Gondola(
        id: id,
        name: _s(m['name']),
        iconName: m['iconName'] as String?,
        order: _i(m['order']) ?? 0,
      );
}

class Product {
  final String id;
  final String gondolaId;
  final String name;
  final double price;
  final String? imageUrl;
  final int order;
  final bool active;
  final String? description;
  final String? unit;
  final String? brand;
  final String? subcategory;
  final int? stockQuantity;
  final List<String> tags;
  final Map<String, String> nutrition;
  final bool inPromo;
  final double? promoPrice;
  final dynamic promoEndsAt;
  final int salesCount;

  Product({
    required this.id,
    required this.gondolaId,
    required this.name,
    required this.price,
    this.imageUrl,
    this.order = 0,
    this.active = true,
    this.description,
    this.unit,
    this.brand,
    this.subcategory,
    this.stockQuantity,
    this.tags = const [],
    this.nutrition = const {},
    this.inPromo = false,
    this.promoPrice,
    this.promoEndsAt,
    this.salesCount = 0,
  });

  factory Product.fromMap(String id, Map<String, dynamic> m) => Product(
        id: id,
        gondolaId: _s(m['gondolaId']),
        name: _s(m['name']),
        price: _d(m['price']),
        imageUrl: m['imageUrl'] as String?,
        order: _i(m['order']) ?? 0,
        active: m['active'] != false,
        description: m['description'] as String?,
        unit: m['unit'] as String?,
        brand: m['brand'] as String?,
        subcategory: m['subcategory'] as String?,
        // A loja escreve `stockQuantity`; `stock` é legado.
        stockQuantity: _i(m['stockQuantity']) ?? _i(m['stock']),
        tags: (m['tags'] as List?)?.map((e) => e.toString()).toList() ?? const [],
        nutrition: (m['nutrition'] as Map?)
                ?.map((k, v) => MapEntry(k.toString(), v.toString())) ??
            const {},
        inPromo: m['inPromo'] == true,
        promoPrice: m['promoPrice'] is num ? _d(m['promoPrice']) : null,
        promoEndsAt: m['promoEndsAt'],
        salesCount: _i(m['salesCount']) ?? 0,
      );

  /// Estoque disponível; `null` = loja não controla estoque (sempre disponível).
  int? get availableStock => stockQuantity;
  bool get outOfStock => availableStock != null && availableStock! <= 0;
}

class Promotion {
  final String id;
  final bool active;
  final String targetType; // product | subcategory | category
  final String targetId;
  final String type; // percentage | fixed | quantity | free_shipping
  final double value;
  final int? requiredQuantity;
  final String? title;
  final String? couponCode;
  final double? minSubtotal;
  final double? maxDiscount;
  final bool firstOrderOnly;

  Promotion({
    required this.id,
    required this.active,
    required this.targetType,
    required this.targetId,
    required this.type,
    required this.value,
    this.requiredQuantity,
    this.title,
    this.couponCode,
    this.minSubtotal,
    this.maxDiscount,
    this.firstOrderOnly = false,
  });

  factory Promotion.fromMap(String id, Map<String, dynamic> m) => Promotion(
        id: id,
        active: m['active'] != false,
        targetType: _s(m['targetType']),
        targetId: _s(m['targetId']),
        type: _s(m['type']),
        value: _d(m['value']),
        requiredQuantity: _i(m['requiredQuantity']),
        title: m['title'] as String?,
        couponCode: m['couponCode'] as String?,
        minSubtotal: m['minSubtotal'] is num ? _d(m['minSubtotal']) : null,
        maxDiscount: m['maxDiscount'] is num ? _d(m['maxDiscount']) : null,
        firstOrderOnly: m['firstOrderOnly'] == true,
      );
}

/* --------------------------- Config da loja --------------------------- */

class DeliveryConfig {
  final String? shippingType; // transparent | free_diluted
  final double flatFeeValue;
  final double minimumOrderValue;
  final double surgeMultiplier;

  DeliveryConfig({
    this.shippingType,
    this.flatFeeValue = 0,
    this.minimumOrderValue = 0,
    this.surgeMultiplier = 1,
  });

  factory DeliveryConfig.fromMap(Map<String, dynamic> m) => DeliveryConfig(
        shippingType: m['shippingType'] as String?,
        flatFeeValue: _d(m['flatFeeValue']),
        minimumOrderValue: _d(m['minimumOrderValue']),
        surgeMultiplier: _d(m['surgeMultiplier'], 1),
      );

  /// Frete que se aplica sob a política da loja (com frete dinâmico).
  double get deliveryFee {
    final surge = surgeMultiplier < 1 ? 1.0 : surgeMultiplier;
    if (shippingType == 'transparent') {
      return double.parse((flatFeeValue * surge).toStringAsFixed(2));
    }
    return 0; // free_diluted
  }

  bool get surgeActive => surgeMultiplier > 1;

  /// Mínimo do pedido (RF13) — só se aplica no modo frete grátis diluído.
  double get minimum => shippingType == 'free_diluted' ? minimumOrderValue : 0;
}

class DayHours {
  final bool isOpen;
  final String openTime;
  final String closeTime;
  DayHours({required this.isOpen, this.openTime = '', this.closeTime = ''});

  factory DayHours.fromMap(Map<String, dynamic> m) => DayHours(
        isOpen: m['isOpen'] == true,
        openTime: _s(m['openTime']),
        closeTime: _s(m['closeTime']),
      );
}

class StoreInfo {
  final Map<String, DayHours> openingHours;
  final Map<String, dynamic> paymentMethods;
  final String? address;
  final double? lat;
  final double? lng;

  StoreInfo({
    this.openingHours = const {},
    this.paymentMethods = const {},
    this.address,
    this.lat,
    this.lng,
  });

  factory StoreInfo.fromMap(Map<String, dynamic> m) {
    final hours = <String, DayHours>{};
    (m['openingHours'] as Map?)?.forEach((k, v) {
      if (v is Map) hours[k.toString()] = DayHours.fromMap(Map<String, dynamic>.from(v));
    });
    final loc = (m['storeLocation'] as Map?) ?? const {};
    return StoreInfo(
      openingHours: hours,
      paymentMethods:
          (m['paymentMethods'] as Map?)?.map((k, v) => MapEntry(k.toString(), v)) ?? const {},
      address: loc['address'] as String?,
      lat: loc['lat'] is num ? _d(loc['lat']) : null,
      lng: loc['lng'] is num ? _d(loc['lng']) : null,
    );
  }

  static const _dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  bool get isOpenNow {
    if (openingHours.isEmpty) return true;
    final today = openingHours[_dayKeys[DateTime.now().weekday % 7]];
    if (today == null || !today.isOpen) return false;
    int? toMin(String s) {
      final parts = s.split(':');
      final h = int.tryParse(parts.first);
      if (h == null) return null;
      final m = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
      return h * 60 + m;
    }

    final open = toMin(today.openTime);
    final close = toMin(today.closeTime);
    if (open == null || close == null) return true;
    final now = DateTime.now();
    final nowMin = now.hour * 60 + now.minute;
    if (close <= open) return nowMin >= open; // vira a meia-noite
    return nowMin >= open && nowMin <= close;
  }

  String get todayLabel {
    if (openingHours.isEmpty) return '';
    final today = openingHours[_dayKeys[DateTime.now().weekday % 7]];
    if (today == null || !today.isOpen) return 'Fechado hoje';
    return 'Hoje: ${today.openTime} às ${today.closeTime}';
  }
}

/// Config white-label do GondolaAppBuilder (RNF01).
class AppConfig {
  final String? storeName;
  final String? accentColor;
  final String? backgroundColor;
  final String? textColor;

  AppConfig({this.storeName, this.accentColor, this.backgroundColor, this.textColor});

  factory AppConfig.fromMap(Map<String, dynamic> m) => AppConfig(
        storeName: m['storeName'] as String?,
        accentColor: m['accentColor'] as String?,
        backgroundColor: m['backgroundColor'] as String?,
        textColor: m['textColor'] as String?,
      );
}

/* --------------------------- Cliente --------------------------- */

class SavedAddress {
  final String id;
  final String label; // casa | trabalho | outro
  final String? nickname;
  final String? cep;
  final String street;
  final String number;
  final String? complement;
  final String? neighborhood;
  final String? city;
  final String? state;
  final String? reference;
  final double? lat;
  final double? lng;

  SavedAddress({
    required this.id,
    this.label = 'casa',
    this.nickname,
    this.cep,
    this.street = '',
    this.number = '',
    this.complement,
    this.neighborhood,
    this.city,
    this.state,
    this.reference,
    this.lat,
    this.lng,
  });

  factory SavedAddress.fromMap(Map<String, dynamic> m) => SavedAddress(
        id: _s(m['id']),
        label: _s(m['label'], 'casa'),
        nickname: m['nickname'] as String?,
        cep: m['cep'] as String?,
        street: _s(m['street']),
        number: _s(m['number']),
        complement: m['complement'] as String?,
        neighborhood: m['neighborhood'] as String?,
        city: m['city'] as String?,
        state: m['state'] as String?,
        reference: m['reference'] as String?,
        lat: m['lat'] is num ? _d(m['lat']) : null,
        lng: m['lng'] is num ? _d(m['lng']) : null,
      );

  Map<String, dynamic> toMap() => {
        'id': id,
        'label': label,
        'nickname': nickname ?? '',
        'cep': cep ?? '',
        'street': street,
        'number': number,
        'complement': complement ?? '',
        'neighborhood': neighborhood ?? '',
        'city': city ?? '',
        'state': state ?? '',
        'reference': reference ?? '',
        if (lat != null) 'lat': lat,
        if (lng != null) 'lng': lng,
      };

  String get oneLine {
    final parts = <String>[
      if (street.isNotEmpty) '$street, $number',
      if ((neighborhood ?? '').isNotEmpty) neighborhood!,
      if ((city ?? '').isNotEmpty) city!,
    ];
    return parts.join(' — ');
  }
}

class CustomerProfile {
  final String uid;
  final String name;
  final String email;
  final String phone;
  final List<SavedAddress> addresses;
  final String? defaultAddressId;
  final List<String> favorites;
  final String? lastSupermarketId;
  final double walletBalance;

  CustomerProfile({
    required this.uid,
    this.name = '',
    this.email = '',
    this.phone = '',
    this.addresses = const [],
    this.defaultAddressId,
    this.favorites = const [],
    this.lastSupermarketId,
    this.walletBalance = 0,
  });

  factory CustomerProfile.fromMap(String uid, Map<String, dynamic> m) => CustomerProfile(
        uid: uid,
        name: _s(m['name']),
        email: _s(m['email']),
        phone: _s(m['phone']),
        addresses: (m['addresses'] as List?)
                ?.whereType<Map>()
                .map((e) => SavedAddress.fromMap(Map<String, dynamic>.from(e)))
                .toList() ??
            const [],
        defaultAddressId: m['defaultAddressId'] as String?,
        favorites: (m['favorites'] as List?)?.map((e) => e.toString()).toList() ?? const [],
        lastSupermarketId: m['lastSupermarketId'] as String?,
        walletBalance: _d(m['walletBalance']),
      );

  SavedAddress? get defaultAddress {
    if (addresses.isEmpty) return null;
    return addresses.firstWhere((a) => a.id == defaultAddressId, orElse: () => addresses.first);
  }
}

/* --------------------------- Pedidos --------------------------- */

class OrderItem {
  final String productId;
  final String name;
  final int quantity;
  final double price;
  final String imageUrl;
  final String unit;
  final bool separated;
  final bool missing;
  final bool substituted;
  final String? substituteName;
  final double? substitutePrice;
  final String customerDecision; // pending | accepted | rejected | ''
  final bool reported;

  OrderItem({
    required this.productId,
    required this.name,
    required this.quantity,
    required this.price,
    this.imageUrl = '',
    this.unit = '',
    this.separated = false,
    this.missing = false,
    this.substituted = false,
    this.substituteName,
    this.substitutePrice,
    this.customerDecision = '',
    this.reported = false,
  });

  factory OrderItem.fromMap(Map<String, dynamic> m) => OrderItem(
        productId: _s(m['productId']),
        name: _s(m['name']),
        quantity: _i(m['quantity']) ?? 1,
        price: _d(m['price']),
        imageUrl: _s(m['imageUrl']),
        unit: _s(m['unit']),
        separated: m['separated'] == true,
        missing: m['missing'] == true,
        substituted: m['substituted'] == true,
        substituteName: m['substituteName'] as String?,
        substitutePrice: m['substitutePrice'] is num ? _d(m['substitutePrice']) : null,
        customerDecision: _s(m['customerDecision']),
        reported: m['reported'] == true,
      );

  Map<String, dynamic> toMap() => {
        'productId': productId,
        'name': name,
        'quantity': quantity,
        'price': price,
        'imageUrl': imageUrl,
        'unit': unit,
        'separated': separated,
        'missing': missing,
        'substituted': substituted,
        if (substituteName != null) 'substituteName': substituteName,
        if (substitutePrice != null) 'substitutePrice': substitutePrice,
        if (customerDecision.isNotEmpty) 'customerDecision': customerDecision,
        if (reported) 'reported': reported,
      };

  OrderItem copyWith({
    bool? missing,
    bool? substituted,
    String? customerDecision,
    bool? reported,
  }) =>
      OrderItem(
        productId: productId,
        name: name,
        quantity: quantity,
        price: price,
        imageUrl: imageUrl,
        unit: unit,
        separated: separated,
        missing: missing ?? this.missing,
        substituted: substituted ?? this.substituted,
        substituteName: substituteName,
        substitutePrice: substitutePrice,
        customerDecision: customerDecision ?? this.customerDecision,
        reported: reported ?? this.reported,
      );
}

class GeoPointLite {
  final double lat;
  final double lng;
  GeoPointLite(this.lat, this.lng);

  static GeoPointLite? fromMap(Map<String, dynamic>? m) {
    if (m == null) return null;
    final lat = m['lat'], lng = m['lng'];
    if (lat is num && lng is num) return GeoPointLite(lat.toDouble(), lng.toDouble());
    return null;
  }
}

class Order {
  final String id;
  final String supermarketId;
  final String customerId;
  final String status;
  final List<OrderItem> items;
  final double total;
  final double subtotal;
  final double deliveryFee;
  final double discount;
  final String couponCode;
  final String fulfillment; // delivery | pickup
  final String paymentMethod;
  final String paymentStatus;
  final double tip;
  final String? deliveryPin;
  final String? scheduledFor;
  final double? changeFor;
  final String notes;
  final String? deliveryStatus;
  final Map<String, dynamic>? deliveryAddress;
  final String customerName;
  final String customerPhone;
  final String? driverId;
  final String? driverName;
  final GeoPointLite? driverLocation;
  final int? rating;
  final String ratingComment;
  final dynamic createdAt;
  // Enriquecidos no cliente:
  final String storeName;
  final String? storeLogoUrl;

  Order({
    required this.id,
    required this.supermarketId,
    required this.customerId,
    required this.status,
    required this.items,
    required this.total,
    this.subtotal = 0,
    this.deliveryFee = 0,
    this.discount = 0,
    this.couponCode = '',
    this.fulfillment = 'delivery',
    this.paymentMethod = '',
    this.paymentStatus = '',
    this.tip = 0,
    this.deliveryPin,
    this.scheduledFor,
    this.changeFor,
    this.notes = '',
    this.deliveryStatus,
    this.deliveryAddress,
    this.customerName = '',
    this.customerPhone = '',
    this.driverId,
    this.driverName,
    this.driverLocation,
    this.rating,
    this.ratingComment = '',
    this.createdAt,
    this.storeName = 'Loja',
    this.storeLogoUrl,
  });

  factory Order.fromMap(String id, Map<String, dynamic> m,
      {String storeName = 'Loja', String? storeLogoUrl}) {
    return Order(
      id: id,
      supermarketId: _s(m['supermarketId']),
      customerId: _s(m['customerId']),
      status: _s(m['status'], 'pending'),
      items: (m['items'] as List?)
              ?.whereType<Map>()
              .map((e) => OrderItem.fromMap(Map<String, dynamic>.from(e)))
              .toList() ??
          const [],
      total: _d(m['total']),
      subtotal: _d(m['subtotal']),
      deliveryFee: _d(m['deliveryFee']),
      discount: _d(m['discount']),
      couponCode: _s(m['couponCode']),
      fulfillment: _s(m['fulfillment'], 'delivery'),
      paymentMethod: _s(m['paymentMethod']),
      paymentStatus: _s(m['paymentStatus']),
      tip: _d(m['tip']),
      deliveryPin: m['deliveryPin'] as String?,
      scheduledFor: m['scheduledFor'] as String?,
      changeFor: m['changeFor'] is num ? _d(m['changeFor']) : null,
      notes: _s(m['notes']),
      deliveryStatus: m['deliveryStatus'] as String?,
      deliveryAddress: (m['deliveryAddress'] as Map?)
          ?.map((k, v) => MapEntry(k.toString(), v)),
      customerName: _s(m['customerName']),
      customerPhone: _s(m['customerPhone']),
      driverId: m['driverId'] as String?,
      driverName: m['driverName'] as String?,
      driverLocation: m['driverLocation'] is Map
          ? GeoPointLite.fromMap(Map<String, dynamic>.from(m['driverLocation'] as Map))
          : null,
      rating: _i(m['rating']),
      ratingComment: _s(m['ratingComment']),
      createdAt: m['createdAt'],
      storeName: storeName,
      storeLogoUrl: storeLogoUrl,
    );
  }

  static const activeStatuses = ['pending', 'picking', 'waiting_substitution', 'ready'];

  bool get isActive => activeStatuses.contains(status) && deliveryStatus != 'delivered';
  bool get isFinished =>
      status == 'delivered' || status == 'cancelled' || deliveryStatus == 'delivered';

  /// Pedido aguardando o cliente revisar substituições.
  bool get needsSubstitutionReview =>
      status == 'waiting_substitution' &&
      items.any((i) =>
          (i.missing || i.substituted) &&
          (i.customerDecision.isEmpty || i.customerDecision == 'pending'));

  bool get canCancel => status == 'pending' || status == 'picking';
}

/* --------------------------- Chat --------------------------- */

class ChatMessage {
  final String id;
  final String text;
  final String senderId;
  final String senderRole; // driver | customer | store | support
  final dynamic createdAt;

  ChatMessage({
    required this.id,
    required this.text,
    required this.senderId,
    required this.senderRole,
    this.createdAt,
  });

  factory ChatMessage.fromMap(String id, Map<String, dynamic> m) => ChatMessage(
        id: id,
        text: _s(m['text']),
        senderId: _s(m['senderId']),
        senderRole: _s(m['senderRole']),
        createdAt: m['createdAt'],
      );
}

/// Entregador público para rastreio (RF21).
class PublicDriver {
  final String uid;
  final String name;
  final double rating;
  final String vehicleLabel;
  final GeoPointLite? location;

  PublicDriver({
    required this.uid,
    this.name = 'Entregador',
    this.rating = 5,
    this.vehicleLabel = '',
    this.location,
  });

  factory PublicDriver.fromMap(String uid, Map<String, dynamic> m) {
    final v = (m['vehicle'] as Map?) ?? const {};
    final label = [v['model'], v['plate']].whereType<String>().where((s) => s.isNotEmpty).join(' · ');
    return PublicDriver(
      uid: uid,
      name: _s(m['name'], 'Entregador'),
      rating: _d(m['rating'], 5),
      vehicleLabel: label,
      location: m['location'] is Map
          ? GeoPointLite.fromMap(Map<String, dynamic>.from(m['location'] as Map))
          : null,
    );
  }
}
