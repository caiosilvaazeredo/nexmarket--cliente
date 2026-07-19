import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:http/http.dart' as http;

import '../models.dart';
import 'fire.dart';

/// Perfil do cliente em /customers/{uid} (RF03, RNF12).
class CustomersRepo {
  static DocumentReference<Map<String, dynamic>> _ref(String uid) =>
      Fire.db.doc('customers/$uid');

  static Stream<CustomerProfile?> profile(String uid) {
    return _ref(uid).snapshots().map(
        (d) => d.exists ? CustomerProfile.fromMap(uid, d.data()!) : null);
  }

  static Future<void> ensureProfile(String uid,
      {String name = '', String email = '', String phone = ''}) async {
    await _ref(uid).set({
      'uid': uid,
      if (name.isNotEmpty) 'name': name,
      if (email.isNotEmpty) 'email': email,
      if (phone.isNotEmpty) 'phone': phone,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  static Future<void> update(String uid, Map<String, dynamic> partial) async {
    await _ref(uid).set({
      ...partial,
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  static Future<void> saveAddresses(String uid, List<SavedAddress> addresses,
      {String? defaultAddressId}) async {
    await update(uid, {
      'addresses': addresses.map((a) => a.toMap()).toList(),
      if (defaultAddressId != null) 'defaultAddressId': defaultAddressId,
    });
  }

  static Future<void> setLastSupermarket(String uid, String smId) =>
      update(uid, {'lastSupermarketId': smId});

  /// LGPD (RNF12): apaga os dados do cliente e a conta de autenticação.
  static Future<void> deleteAccount(String uid) async {
    await _ref(uid).delete();
    await Fire.auth.currentUser?.delete();
  }
}

/// Auto-completar endereço por CEP via ViaCEP (RF04).
Future<SavedAddress?> lookupCep(String cep) async {
  final clean = cep.replaceAll(RegExp(r'\D'), '');
  if (clean.length != 8) return null;
  try {
    final res = await http
        .get(Uri.parse('https://viacep.com.br/ws/$clean/json/'))
        .timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return null;
    final data = jsonDecode(res.body) as Map<String, dynamic>;
    if (data['erro'] == true) return null;
    return SavedAddress(
      id: '',
      cep: clean,
      street: (data['logradouro'] as String?) ?? '',
      neighborhood: data['bairro'] as String?,
      city: data['localidade'] as String?,
      state: data['uf'] as String?,
    );
  } catch (_) {
    return null;
  }
}
