import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../services/customers_repo.dart';
import '../services/fire.dart';
import '../services/identity_api.dart';

/// Login por e-mail/senha (RF01) e recuperação de senha (RF02). Login social
/// (Google/Apple/telefone) pode ser adicionado com os pacotes google_sign_in /
/// sign_in_with_apple sobre esta mesma tela.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;

  Future<void> _run(Future<void> Function() fn) async {
    setState(() => _busy = true);
    try {
      await fn();
      if (mounted) Navigator.of(context).pop(true);
    } on FirebaseAuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_authError(e))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Entrar')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text('Que bom te ver!',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 20),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'E-mail'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Senha'),
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy
                ? null
                : () => _run(() async {
                      await Fire.auth.signInWithEmailAndPassword(
                          email: _email.text.trim(), password: _password.text);
                      // Contas criadas antes da identidade unificada ganham o
                      // papel aqui, sem o usuário perceber.
                      await IdentityApi.claim(role: 'cliente');
                    }),
            child: _busy
                ? const SizedBox(
                    width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Entrar'),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: _busy
                ? null
                : () async {
                    final created = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(builder: (_) => const RegisterScreen()));
                    if (created == true && context.mounted) {
                      Navigator.of(context).pop(true);
                    }
                  },
            child: const Text('Criar conta'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const RecoveryScreen())),
            child: const Text('Esqueci minha senha'),
          ),
        ],
      ),
    );
  }
}

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;

  Future<void> _register() async {
    if (_name.text.trim().isEmpty || _email.text.trim().isEmpty) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Preencha nome e e-mail.')));
      return;
    }
    setState(() => _busy = true);
    try {
      final cred = await Fire.auth.createUserWithEmailAndPassword(
          email: _email.text.trim(), password: _password.text);
      await cred.user?.updateDisplayName(_name.text.trim());
      await CustomersRepo.ensureProfile(cred.user!.uid,
          name: _name.text.trim(), email: _email.text.trim(), phone: _phone.text.trim());
      // Registra o papel na identidade única da plataforma (o mesmo e-mail
      // passa a ser a mesma pessoa nos quatro apps) e dispara o e-mail de
      // boas-vindas pelo servidor.
      await IdentityApi.claim(role: 'cliente', name: _name.text.trim());
      if (mounted) Navigator.of(context).pop(true);
    } on FirebaseAuthException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(_authError(e))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Criar conta')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Nome')),
          const SizedBox(height: 12),
          TextField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Celular (com DDD)')),
          const SizedBox(height: 12),
          TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(labelText: 'E-mail')),
          const SizedBox(height: 12),
          TextField(
              controller: _password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Senha (mín. 6 caracteres)')),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy ? null : _register,
            child: _busy
                ? const SizedBox(
                    width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Cadastrar'),
          ),
        ],
      ),
    );
  }
}

class RecoveryScreen extends StatefulWidget {
  const RecoveryScreen({super.key});

  @override
  State<RecoveryScreen> createState() => _RecoveryScreenState();
}

class _RecoveryScreenState extends State<RecoveryScreen> {
  final _email = TextEditingController();
  bool _sent = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recuperar senha')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
              'Enviaremos um link de redefinição para o seu e-mail. A nova '
              'senha vale para todos os apps da Nexmarket.'),
          const SizedBox(height: 16),
          TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'E-mail')),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _sent
                ? null
                : () async {
                    final email = _email.text.trim();
                    // Preferimos o servidor (mesmo e-mail para os 4 apps e a
                    // senha vale em todos); sem ele, cai no Firebase nativo.
                    if (await IdentityApi.forgotPassword(email)) {
                      if (context.mounted) setState(() => _sent = true);
                      return;
                    }
                    try {
                      await Fire.auth.sendPasswordResetEmail(email: email);
                      setState(() => _sent = true);
                    } on FirebaseAuthException catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context)
                            .showSnackBar(SnackBar(content: Text(_authError(e))));
                      }
                    }
                  },
            child: Text(_sent ? 'E-mail enviado ✓' : 'Enviar link'),
          ),
        ],
      ),
    );
  }
}

String _authError(FirebaseAuthException e) {
  switch (e.code) {
    case 'invalid-credential':
    case 'wrong-password':
    case 'user-not-found':
      return 'E-mail ou senha incorretos.';
    case 'email-already-in-use':
      return 'Este e-mail já está cadastrado.';
    case 'weak-password':
      return 'A senha precisa ter pelo menos 6 caracteres.';
    case 'invalid-email':
      return 'E-mail inválido.';
    case 'network-request-failed':
      return 'Sem conexão. Tente novamente.';
    default:
      return 'Não foi possível concluir (${e.code}).';
  }
}

/// Garante que há um usuário logado antes de uma ação (ex.: checkout).
Future<bool> ensureLoggedIn(BuildContext context) async {
  if (Fire.uid != null && !(Fire.auth.currentUser?.isAnonymous ?? false)) return true;
  final ok = await Navigator.of(context)
      .push<bool>(MaterialPageRoute(builder: (_) => const LoginScreen()));
  return ok == true;
}
