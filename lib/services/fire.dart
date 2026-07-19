import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

import '../firebase_options.dart';

/// Ponto único de acesso ao Firebase. A plataforma Nexmarket usa um banco
/// Firestore NOMEADO (não o "(default)"), então todo acesso passa por aqui.
class Fire {
  static late final FirebaseFirestore db;
  static FirebaseAuth get auth => FirebaseAuth.instance;

  static Future<void> init() async {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    db = FirebaseFirestore.instanceFor(
      app: Firebase.app(),
      databaseId: DefaultFirebaseOptions.firestoreDatabaseId,
    );
    db.settings = const Settings(persistenceEnabled: true);
  }

  static String? get uid => auth.currentUser?.uid;
}
