import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/catalog_repo.dart';
import '../state/app_state.dart';
import '../theme.dart';

/// Uma loja da lista já enriquecida com horários, política de entrega e a
/// distância até o cliente (quando a localização está disponível).
class StoreEntry {
  final Supermarket store;
  final StoreInfo? info;
  final DeliveryConfig? delivery;
  final double? distanceMeters;

  StoreEntry({required this.store, this.info, this.delivery, this.distanceMeters});

  bool get isOpen => info?.isOpenNow ?? true;
  bool get hasFreeShipping => (delivery?.deliveryFee ?? 0) == 0;

  StoreEntry withDistance(double? meters) => StoreEntry(
        store: store,
        info: info,
        delivery: delivery,
        distanceMeters: meters,
      );
}

enum StoreSort { distancia, nome, frete }

/// Escolha do supermercado (descoberta/onboarding). A navegação é livre sem
/// login — o login só é exigido no checkout.
///
/// Serve tanto de tela inicial (primeiro acesso) quanto de "trocar de
/// mercado" empurrada por cima do app — neste caso ela se fecha ao escolher.
class StorePickerScreen extends StatefulWidget {
  const StorePickerScreen({super.key});

  @override
  State<StorePickerScreen> createState() => _StorePickerScreenState();
}

class _StorePickerScreenState extends State<StorePickerScreen> {
  String _query = '';
  bool _openOnly = false;
  bool _freeShippingOnly = false;
  StoreSort _sort = StoreSort.nome;

  Position? _position;
  bool _locating = false;
  String? _locationError;

  /// Detalhes (horários/entrega) já carregados, por id de loja.
  final Map<String, StoreEntry> _details = {};
  final Set<String> _loading = {};

  /// Busca horários + política de entrega de uma loja, uma única vez.
  Future<void> _loadDetails(Supermarket sm) async {
    if (_details.containsKey(sm.id) || _loading.contains(sm.id)) return;
    _loading.add(sm.id);
    final results = await Future.wait([
      CatalogRepo.storeInfoOnce(sm.id),
      CatalogRepo.deliveryConfigOnce(sm.id),
    ]);
    if (!mounted) return;
    setState(() {
      _details[sm.id] = StoreEntry(
        store: sm,
        info: results[0] as StoreInfo?,
        delivery: results[1] as DeliveryConfig?,
      );
      _loading.remove(sm.id);
    });
  }

  /// Pede a localização e passa a ordenar por distância (RF04).
  Future<void> _useMyLocation() async {
    setState(() {
      _locating = true;
      _locationError = null;
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw 'Ative a localização do aparelho.';
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw 'Permissão de localização negada.';
      }
      final pos = await Geolocator.getCurrentPosition();
      if (!mounted) return;
      setState(() {
        _position = pos;
        _sort = StoreSort.distancia;
      });
    } catch (e) {
      if (mounted) setState(() => _locationError = '$e');
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  double? _distanceTo(StoreEntry entry) {
    final pos = _position;
    final lat = entry.info?.lat, lng = entry.info?.lng;
    if (pos == null || lat == null || lng == null) return null;
    return Geolocator.distanceBetween(pos.latitude, pos.longitude, lat, lng);
  }

  String _formatDistance(double meters) => meters < 1000
      ? '${meters.round()} m'
      : '${(meters / 1000).toStringAsFixed(1).replaceAll('.', ',')} km';

  /// Aplica busca, filtros e ordenação sobre a lista ao vivo.
  List<StoreEntry> _apply(List<Supermarket> stores) {
    final q = _query.trim().toLowerCase();
    var list = stores.map((sm) {
      final base = _details[sm.id] ?? StoreEntry(store: sm);
      return base.withDistance(_distanceTo(base));
    }).toList();

    if (q.isNotEmpty) {
      list = list.where((e) => e.store.name.toLowerCase().contains(q)).toList();
    }
    // Filtros só descartam quando os detalhes já chegaram — evita a lista
    // "piscar" vazia enquanto carrega.
    if (_openOnly) {
      list = list.where((e) => !_details.containsKey(e.store.id) || e.isOpen).toList();
    }
    if (_freeShippingOnly) {
      list = list
          .where((e) => !_details.containsKey(e.store.id) || e.hasFreeShipping)
          .toList();
    }

    switch (_sort) {
      case StoreSort.distancia:
        list.sort((a, b) {
          final da = a.distanceMeters, db = b.distanceMeters;
          if (da == null && db == null) return a.store.name.compareTo(b.store.name);
          if (da == null) return 1;
          if (db == null) return -1;
          return da.compareTo(db);
        });
      case StoreSort.frete:
        list.sort((a, b) {
          final fa = a.delivery?.deliveryFee ?? double.maxFinite;
          final fb = b.delivery?.deliveryFee ?? double.maxFinite;
          final cmp = fa.compareTo(fb);
          return cmp != 0 ? cmp : a.store.name.compareTo(b.store.name);
        });
      case StoreSort.nome:
        list.sort((a, b) => a.store.name.compareTo(b.store.name));
    }
    return list;
  }

  /// Seleciona a loja e fecha a tela quando ela foi aberta para troca.
  Future<void> _select(String smId) async {
    final navigator = Navigator.of(context);
    await context.read<AppState>().selectSupermarket(smId);
    if (navigator.canPop()) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    // Quando dá para voltar, a tela foi aberta como "trocar de mercado".
    final isSwitching = Navigator.of(context).canPop();

    return Scaffold(
      appBar: isSwitching ? AppBar(title: const Text('Trocar de mercado')) : null,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(20, isSwitching ? 12 : 24, 20, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!isSwitching) ...[
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: kGreen,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(Icons.storefront,
                          color: Colors.white, size: 36),
                    ),
                    const SizedBox(height: 16),
                    const Text('Bem-vindo!',
                        style:
                            TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 4),
                  ],
                  Text(
                      isSwitching
                          ? 'Seu carrinho fica guardado em cada mercado.'
                          : 'Escolha o mercado para começar as compras',
                      style:
                          TextStyle(fontSize: 16, color: Colors.grey.shade600)),
                ],
              ),
            ),

            // Busca por nome
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: TextField(
                onChanged: (v) => setState(() => _query = v),
                decoration: const InputDecoration(
                  hintText: 'Buscar mercado pelo nome',
                  prefixIcon: Icon(Icons.search),
                ),
              ),
            ),

            // Filtros e ordenação
            SizedBox(
              height: 60,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                children: [
                  FilterChip(
                    avatar: _locating
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.my_location, size: 18),
                    label: Text(_position == null ? 'Perto de mim' : 'Por distância'),
                    selected: _sort == StoreSort.distancia && _position != null,
                    onSelected: (v) {
                      if (_position == null) {
                        _useMyLocation();
                      } else {
                        setState(() =>
                            _sort = v ? StoreSort.distancia : StoreSort.nome);
                      }
                    },
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Abertos agora'),
                    selected: _openOnly,
                    onSelected: (v) => setState(() => _openOnly = v),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('Frete grátis'),
                    selected: _freeShippingOnly,
                    onSelected: (v) => setState(() => _freeShippingOnly = v),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    avatar: const Icon(Icons.sort, size: 18),
                    label: const Text('Menor frete'),
                    selected: _sort == StoreSort.frete,
                    onSelected: (v) =>
                        setState(() => _sort = v ? StoreSort.frete : StoreSort.nome),
                  ),
                  const SizedBox(width: 8),
                  FilterChip(
                    label: const Text('A-Z'),
                    selected: _sort == StoreSort.nome,
                    onSelected: (_) => setState(() => _sort = StoreSort.nome),
                  ),
                ],
              ),
            ),
            if (_locationError != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text(_locationError!,
                    style: const TextStyle(color: Colors.redAccent, fontSize: 12.5)),
              ),

            Expanded(
              child: StreamBuilder<List<Supermarket>>(
                stream: CatalogRepo.supermarkets(),
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final stores = snap.data ?? [];
                  if (stores.isEmpty) {
                    return const Center(
                        child: Text('Nenhuma loja disponível no momento.'));
                  }
                  // Carrega horários/entrega de cada loja para filtros e selos.
                  for (final sm in stores) {
                    _loadDetails(sm);
                  }

                  final entries = _apply(stores);
                  if (entries.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(32),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.store_mall_directory_outlined,
                                size: 56, color: Colors.grey.shade300),
                            const SizedBox(height: 12),
                            const Text('Nenhum mercado com esses filtros',
                                style: TextStyle(fontWeight: FontWeight.w800)),
                            TextButton(
                              onPressed: () => setState(() {
                                _query = '';
                                _openOnly = false;
                                _freeShippingOnly = false;
                              }),
                              child: const Text('Limpar filtros'),
                            ),
                          ],
                        ),
                      ),
                    );
                  }

                  return ListView.separated(
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                    itemCount: entries.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, i) => _StoreTile(
                      entry: entries[i],
                      isCurrent: entries[i].store.id == app.supermarketId,
                      distanceLabel: entries[i].distanceMeters == null
                          ? null
                          : _formatDistance(entries[i].distanceMeters!),
                      onTap: () => _select(entries[i].store.id),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StoreTile extends StatelessWidget {
  final StoreEntry entry;
  final bool isCurrent;
  final String? distanceLabel;
  final VoidCallback onTap;

  const _StoreTile({
    required this.entry,
    required this.isCurrent,
    required this.distanceLabel,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final sm = entry.store;
    final loaded = entry.info != null || entry.delivery != null;
    final fee = entry.delivery?.deliveryFee;

    final subtitle = <String>[
      if (loaded) (entry.isOpen ? 'Aberto agora' : 'Fechado'),
      if (distanceLabel != null) distanceLabel!,
      if (fee != null) (fee == 0 ? 'Frete grátis' : 'Frete ${money(fee)}'),
    ].join(' · ');

    return Card(
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: kGreen.withValues(alpha: .15),
          backgroundImage:
              (sm.logoUrl ?? '').isNotEmpty ? NetworkImage(sm.logoUrl!) : null,
          child: (sm.logoUrl ?? '').isEmpty
              ? const Icon(Icons.store, color: kGreenDark)
              : null,
        ),
        title: Row(
          children: [
            Flexible(
              child: Text(sm.name,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w800)),
            ),
            if (isCurrent)
              Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: kGreen.withValues(alpha: .18),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text('Atual',
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                          color: kGreenDark)),
                ),
              ),
          ],
        ),
        subtitle: subtitle.isEmpty
            ? null
            : Text(subtitle,
                style: TextStyle(
                    fontSize: 12.5,
                    color: loaded && !entry.isOpen
                        ? Colors.redAccent
                        : Colors.grey.shade600)),
        trailing: Icon(isCurrent ? Icons.check_circle : Icons.chevron_right,
            color: isCurrent ? kGreen : null),
        onTap: onTap,
      ),
    );
  }
}
