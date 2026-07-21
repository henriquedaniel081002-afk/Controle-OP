import React, { useState } from 'react';
import { AlertCircle, Factory, Loader2, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
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

  const requiredFieldsError = error === 'Informe e-mail e senha para entrar.';
  const credentialsError = error === 'E-mail ou senha inválidos. Verifique o usuário criado no Supabase.';
  const emailHasError = credentialsError || (requiredFieldsError && !email.trim());
  const passwordHasError = credentialsError || (requiredFieldsError && !password.trim());

  return (
    <main className="relative min-h-screen overflow-hidden bg-canvas text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(41,53,66,0.24)_1px,transparent_1px),linear-gradient(90deg,rgba(41,53,66,0.24)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
      />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1480px] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section className="flex flex-col justify-between px-5 py-8 sm:px-10 lg:px-14 lg:py-12" aria-labelledby="brand-title">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald/30 bg-emerald/10 text-emerald shadow-[0_0_28px_rgba(32,199,122,0.08)]">
              <Factory className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-ink uppercase">Controle de OP</p>
              <p className="mt-0.5 text-xs text-muted">Painel operacional</p>
            </div>
          </div>

          <div className="my-12 hidden max-w-2xl lg:my-0 lg:block">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1.5 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald" aria-hidden="true" />
              Acesso corporativo
            </div>
            <h1 id="brand-title" className="max-w-xl text-3xl font-semibold tracking-[-0.035em] text-ink sm:text-4xl lg:text-5xl lg:leading-[1.12]">
              Ordens de produção sob controle, com clareza operacional.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted">
              Acompanhe o planejamento mensal, as semanas de produção e as marcações de OP em um único painel.
            </p>
          </div>

          <div className="hidden items-center gap-2 text-xs text-subtle lg:flex">
            <ShieldCheck className="h-4 w-4 text-emerald" aria-hidden="true" />
            Acesso restrito a usuários autorizados
          </div>
        </section>

        <section className="flex items-center justify-center border-t border-line bg-surface/75 px-4 py-10 backdrop-blur-xl sm:px-8 lg:border-t-0 lg:border-l lg:px-12">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-line bg-surface-raised/95 p-5 shadow-panel sm:p-8">
              <div className="mb-7">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong bg-surface-soft text-emerald lg:hidden">
                  <Lock className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-xs font-semibold tracking-[0.18em] text-emerald uppercase">Autenticação</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Acesse o painel</h2>
                <p className="mt-2 text-sm leading-6 text-muted">Entre com o usuário criado no Supabase.</p>
              </div>

              {error && (
                <div
                  id="login-error"
                  role="alert"
                  className="mb-5 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-3.5 text-sm leading-5 text-red-200"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label htmlFor="login-email" className="block text-sm font-medium text-ink">E-mail</label>
                  <div className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-control bg-canvas/60 px-3.5 transition-colors focus-within:border-emerald/70 focus-within:shadow-[var(--focus-ring)]">
                    <Mail className="h-4 w-4 flex-shrink-0 text-subtle" aria-hidden="true" />
                    <input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="usuario@empresa.com"
                      className="min-w-0 flex-1 bg-transparent py-3 text-sm text-ink outline-none"
                      autoComplete="email"
                      aria-invalid={emailHasError}
                      aria-describedby={emailHasError ? 'login-error' : undefined}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-medium text-ink">Senha</label>
                  <div className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-control bg-canvas/60 px-3.5 transition-colors focus-within:border-emerald/70 focus-within:shadow-[var(--focus-ring)]">
                    <Lock className="h-4 w-4 flex-shrink-0 text-subtle" aria-hidden="true" />
                    <input
                      id="login-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Digite a senha"
                      className="min-w-0 flex-1 bg-transparent py-3 text-sm text-ink outline-none"
                      autoComplete="current-password"
                      aria-invalid={passwordHasError}
                      aria-describedby={passwordHasError ? 'login-error' : undefined}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-3 text-sm font-bold text-on-accent shadow-[0_10px_24px_rgba(32,199,122,0.16)] transition-colors hover:bg-emerald-strong disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LogIn className="h-4 w-4" aria-hidden="true" />}
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            </div>

            <p className="mt-5 text-center text-xs leading-5 text-subtle lg:hidden">
              Acesso restrito a usuários autorizados
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
