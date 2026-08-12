import 'package:cloud_firestore/cloud_firestore.dart';

import '../models.dart';
import 'fire.dart';

/// Chat do pedido em /supermarkets/{smId}/orders/{orderId}/messages (RF24).
class ChatRepo {
  static CollectionReference<Map<String, dynamic>> _col(String smId, String orderId) =>
      Fire.db.collection('supermarkets/$smId/orders/$orderId/messages');

  static Stream<List<ChatMessage>> messages(String smId, String orderId) {
    return _col(smId, orderId).orderBy('createdAt').snapshots().map(
        (snap) => snap.docs.map((d) => ChatMessage.fromMap(d.id, d.data())).toList());
  }

  static Future<void> send(String smId, String orderId, String text) async {
    final uid = Fire.uid;
    if (uid == null || text.trim().isEmpty) return;
    await _col(smId, orderId).add({
      'text': text.trim(),
      'senderId': uid,
      'senderRole': 'customer',
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
}
