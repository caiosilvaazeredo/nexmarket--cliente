import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/customers_repo.dart';
import '../state/app_state.dart';
import '../widgets/common.dart';

/// Catálogo de endereços (Casa, Trabalho…) — RF03, com CEP/ViaCEP (RF04).
class AddressesScreen extends StatelessWidget {
  final bool pickMode;
  const AddressesScreen({super.key, this.pickMode = false});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final profile = app.profile;
    final addresses = profile?.addresses ?? [];

    return Scaffold(
      appBar: AppBar(
          title: Text(pickMode ? 'Escolher endereço' : 'Meus endereços')),
      body: addresses.isEmpty
          ? const EmptyState(
              icon: Icons.place_outlined,
              title: 'Nenhum endereço salvo',
              subtitle: 'Adicione um endereço para receber suas compras.')
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: addresses.length,
              separatorBuilder: (_, _) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final a = addresses[i];
                final isDefault = a.id == profile?.defaultAddressId;
                return Card(
                  child: ListTile(
                    leading: Icon(a.label == 'trabalho'
                        ? Icons.work_outline
                        : a.label == 'casa'
                            ? Icons.home_outlined
                            : Icons.place_outlined),
                    title: Text(
                        '${a.nickname?.isNotEmpty == true ? a.nickname! : a.label[0].toUpperCase() + a.label.substring(1)}'
                        '${isDefault ? ' · padrão' : ''}',
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                    subtitle: Text(a.oneLine),
                    trailing: pickMode
                        ? const Icon(Icons.chevron_right)
                        : IconButton(
                            icon: const Icon(Icons.edit_outlined),
                            onPressed: () => _edit(context, a),
                          ),
                    onTap: pickMode
                        ? () => Navigator.of(context).pop(a)
                        : () => _edit(context, a),
                  ),
                );
              },
            ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(16),
        child: FilledButton.icon(
          icon: const Icon(Icons.add),
          label: const Text('Novo endereço'),
          onPressed: () => _edit(context, null),
        ),
      ),
    );
  }

  void _edit(BuildContext context, SavedAddress? address) {
    Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => AddressEditScreen(address: address)));
  }
}

class AddressEditScreen extends StatefulWidget {
  final SavedAddress? address;
  const AddressEditScreen({super.key, this.address});

  @override
  State<AddressEditScreen> createState() => _AddressEditScreenState();
}

class _AddressEditScreenState extends State<AddressEditScreen> {
  late final _cep = TextEditingController(text: widget.address?.cep ?? '');
  late final _street = TextEditingController(text: widget.address?.street ?? '');
  late final _number = TextEditingController(text: widget.address?.number ?? '');
  late final _complement =
      TextEditingController(text: widget.address?.complement ?? '');
  late final _neighborhood =
      TextEditingController(text: widget.address?.neighborhood ?? '');
  late final _city = TextEditingController(text: widget.address?.city ?? '');
  late final _state = TextEditingController(text: widget.address?.state ?? '');
  late final _reference =
      TextEditingController(text: widget.address?.reference ?? '');
  late final _nickname =
      TextEditingController(text: widget.address?.nickname ?? '');
  late String _label = widget.address?.label ?? 'casa';
  bool _default = false;
  bool _cepBusy = false;
  bool _saving = false;

  Future<void> _lookupCep() async {
    setState(() => _cepBusy = true);
    final found = await lookupCep(_cep.text);
    if (found != null) {
      _street.text = found.street;
      _neighborhood.text = found.neighborhood ?? '';
      _city.text = found.city ?? '';
      _state.text = found.state ?? '';
    } else if (mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('CEP não encontrado.')));
    }
    if (mounted) setState(() => _cepBusy = false);
  }

  Future<void> _save() async {
    final app = context.read<AppState>();
    final uid = app.user?.uid;
    if (uid == null) return;
    if (_street.text.trim().isEmpty || _number.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Preencha rua e número.')));
      return;
    }
    setState(() => _saving = true);
    try {
      final id = widget.address?.id.isNotEmpty == true
          ? widget.address!.id
          : DateTime.now().millisecondsSinceEpoch.toString();
      final updated = SavedAddress(
        id: id,
        label: _label,
        nickname: _nickname.text.trim(),
        cep: _cep.text.trim(),
        street: _street.text.trim(),
        number: _number.text.trim(),
        complement: _complement.text.trim(),
        neighborhood: _neighborhood.text.trim(),
        city: _city.text.trim(),
        state: _state.text.trim(),
        reference: _reference.text.trim(),
        lat: widget.address?.lat,
        lng: widget.address?.lng,
      );
      final list = List<SavedAddress>.from(app.profile?.addresses ?? []);
      final idx = list.indexWhere((a) => a.id == id);
      if (idx >= 0) {
        list[idx] = updated;
      } else {
        list.add(updated);
      }
      await CustomersRepo.saveAddresses(uid, list,
          defaultAddressId: _default || list.length == 1 ? id : null);
      if (mounted) Navigator.of(context).pop();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final app = context.read<AppState>();
    final uid = app.user?.uid;
    final id = widget.address?.id;
    if (uid == null || id == null) return;
    final list =
        (app.profile?.addresses ?? []).where((a) => a.id != id).toList();
    await CustomersRepo.saveAddresses(uid, list);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.address == null ? 'Novo endereço' : 'Editar endereço'),
        actions: [
          if (widget.address != null)
            IconButton(
                icon: const Icon(Icons.delete_outline), onPressed: _delete),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _cep,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'CEP'),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 120,
                child: FilledButton(
                  onPressed: _cepBusy ? null : _lookupCep,
                  child: _cepBusy
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Buscar'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
              controller: _street,
              decoration: const InputDecoration(labelText: 'Rua')),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  child: TextField(
                      controller: _number,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Número'))),
              const SizedBox(width: 8),
              Expanded(
                  child: TextField(
                      controller: _complement,
                      decoration:
                          const InputDecoration(labelText: 'Complemento'))),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
              controller: _neighborhood,
              decoration: const InputDecoration(labelText: 'Bairro')),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                  flex: 2,
                  child: TextField(
                      controller: _city,
                      decoration: const InputDecoration(labelText: 'Cidade'))),
              const SizedBox(width: 8),
              Expanded(
                  child: TextField(
                      controller: _state,
                      decoration: const InputDecoration(labelText: 'UF'))),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
              controller: _reference,
              decoration: const InputDecoration(
                  labelText: 'Ponto de referência (opcional)')),
          const SizedBox(height: 12),
          TextField(
              controller: _nickname,
              decoration:
                  const InputDecoration(labelText: 'Apelido (opcional)')),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'casa', label: Text('Casa')),
              ButtonSegment(value: 'trabalho', label: Text('Trabalho')),
              ButtonSegment(value: 'outro', label: Text('Outro')),
            ],
            selected: {_label},
            onSelectionChanged: (s) => setState(() => _label = s.first),
          ),
          SwitchListTile(
            value: _default,
            onChanged: (v) => setState(() => _default = v),
            title: const Text('Usar como endereço padrão'),
            contentPadding: EdgeInsets.zero,
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Salvar endereço'),
          ),
        ],
      ),
    );
  }
}
