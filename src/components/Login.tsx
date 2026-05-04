import React, { useState } from 'react';
import { AlertCircle, Lock, LogIn, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setError('Supabase não configurado. Verifique as variáveis de ambiente.');
      return;
    }

    const emailTrimmed = email.trim();
    const passwordTrimmed = password.trim();

    if (!emailTrimmed || !passwordTrimmed) {
      setError('Informe e-mail e senha para entrar.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: emailTrimmed,
        password: passwordTrimmed
      });

      if (error) {
        setError('E-mail ou senha inválidos. Verifique o usuário criado no Supabase.');
        return;
      }

      onLoginSuccess();
    } catch (err) {
      console.error(err);
      setError('Erro ao tentar entrar. Verifique a conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-white/10 bg-white/[0.03] rounded-2xl shadow-2xl p-6 md:p-8">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#00EE76]/10 border border-[#00EE76]/30 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-[#00EE76]" />
          </div>
          <h1 className="text-2xl font-bold uppercase tracking-tight">Controle de OP</h1>
          <p className="text-sm text-slate-400 mt-2">Acesse com o usuário criado no Supabase.</p>
        </div>

        {error && (
          <div className="mb-5 bg-red-500/10 border border-red-500/20 text-red-300 p-3 rounded-xl flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">E-mail</span>
            <div className="mt-2 flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-3 focus-within:border-[#00EE76]/60 transition-colors">
              <Mail className="w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="usuario@empresa.com"
                className="w-full bg-transparent outline-none text-sm placeholder:text-slate-600"
                autoComplete="email"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Senha</span>
            <div className="mt-2 flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-3 focus-within:border-[#00EE76]/60 transition-colors">
              <Lock className="w-4 h-4 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Digite a senha"
                className="w-full bg-transparent outline-none text-sm placeholder:text-slate-600"
                autoComplete="current-password"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#00EE76] text-black font-bold rounded-xl px-4 py-3 hover:bg-[#00EE76]/90 transition-all disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" />
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
