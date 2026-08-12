import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

import '../firebase_options.dart';

/// Ponto único de acesso ao Firebase. A plataforma Nexmarket usa um banco
/// Firestore NOMEADO (não o "(default)"), então todo acesso passa por aqui.
class Fire {
  static FirebaseFirestore? _db;
  static bool _testMode = false;
  static String? _testUid;

  static FirebaseFirestore get db => _db!;
  static FirebaseAuth get auth => FirebaseAuth.instance;

  static Future<void> init() async {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    _db = FirebaseFirestore.instanceFor(
      app: Firebase.app(),
      databaseId: DefaultFirebaseOptions.firestoreDatabaseId,
    );
    if (!kIsWeb) {
      // Cache offline nativo (no web o cache é gerenciado pelo SDK JS).
      _db!.settings = const Settings(persistenceEnabled: true);
    }
  }

  /// Injeta um Firestore fake e um uid fixo para testes (fake_cloud_firestore).
  @visibleForTesting
  static void overrideForTests(FirebaseFirestore db, {String? uid}) {
    _db = db;
    _testMode = true;
    _testUid = uid;
  }

  @visibleForTesting
  static set testUid(String? uid) => _testUid = uid;

  /// True quando um Firestore fake foi injetado — o estado global usa isso
  /// para não assinar o FirebaseAuth real durante os testes.
  static bool get isTestMode => _testMode;

  static String? get uid => _testMode ? _testUid : auth.currentUser?.uid;
}
