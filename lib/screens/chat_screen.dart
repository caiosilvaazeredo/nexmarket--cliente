import 'package:flutter/material.dart';

import '../models.dart';
import '../services/chat_repo.dart';
import '../services/fire.dart';
import '../theme.dart';

/// Chat do pedido com a loja/entregador (RF24).
class ChatScreen extends StatefulWidget {
  final String supermarketId;
  final String orderId;
  const ChatScreen(
      {super.key, required this.supermarketId, required this.orderId});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _text = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final myUid = Fire.uid;
    return Scaffold(
      appBar: AppBar(title: const Text('Chat do pedido')),
      body: Column(
        children: [
          Expanded(
            child: StreamBuilder<List<ChatMessage>>(
              stream: ChatRepo.messages(widget.supermarketId, widget.orderId),
              builder: (context, snap) {
                final messages = snap.data ?? [];
                if (messages.isEmpty) {
                  return Center(
                      child: Text('Envie uma mensagem para a loja 👋',
                          style: TextStyle(color: Colors.grey.shade500)));
                }
                return ListView.builder(
                  reverse: true,
                  padding: const EdgeInsets.all(16),
                  itemCount: messages.length,
                  itemBuilder: (context, i) {
                    final m = messages[messages.length - 1 - i];
                    final mine = m.senderId == myUid;
                    return Align(
                      alignment:
                          mine ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        constraints: BoxConstraints(
                            maxWidth:
                                MediaQuery.of(context).size.width * .75),
                        decoration: BoxDecoration(
                          color: mine ? kGreen : Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: mine
                              ? null
                              : Border.all(color: const Color(0xFFE5E5E5)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (!mine)
                              Text(
                                m.senderRole == 'store'
                                    ? 'Loja'
                                    : m.senderRole == 'driver'
                                        ? 'Entregador'
                                        : 'Suporte',
                                style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: kGreenDark),
                              ),
                            Text(m.text,
                                style: TextStyle(
                                    color:
                                        mine ? Colors.white : Colors.black87)),
                          ],
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          SafeArea(
            minimum: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _text,
                    decoration:
                        const InputDecoration(hintText: 'Escreva uma mensagem…'),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                    onPressed: _send, icon: const Icon(Icons.send)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _send() {
    final text = _text.text;
    if (text.trim().isEmpty) return;
    ChatRepo.send(widget.supermarketId, widget.orderId, text);
    _text.clear();
  }
}
