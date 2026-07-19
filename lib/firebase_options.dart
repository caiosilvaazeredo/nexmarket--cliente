import 'package:firebase_core/firebase_core.dart';

/// Configuração do projeto Firebase compartilhado com a loja e o entregador
/// (mesmos valores do antigo `firebase-config.json`).
///
/// Para builds de produção você pode substituir este arquivo pelo gerado por
/// `flutterfire configure`, mas estes valores já funcionam para Auth +
/// Firestore em Android e iOS.
class DefaultFirebaseOptions {
  static const FirebaseOptions currentPlatform = FirebaseOptions(
    apiKey: 'AIzaSyCZlEIedHd-pgduoTZDif1wILGk6ed_j5E',
    appId: '1:990951341087:web:65c5f13e0f385698eba92a',
    messagingSenderId: '990951341087',
    projectId: 'gen-lang-client-0615772467',
    authDomain: 'gen-lang-client-0615772467.firebaseapp.com',
    storageBucket: 'gen-lang-client-0615772467.firebasestorage.app',
  );

  /// Banco Firestore NOMEADO usado por toda a plataforma Nexmarket.
  static const String firestoreDatabaseId =
      'ai-studio-2ab80fc8-bdc4-40c4-9282-35669db98074';
}
