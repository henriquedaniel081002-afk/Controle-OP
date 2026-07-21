import React from 'react';
import { Trophy, UserRoundCheck } from 'lucide-react';

interface TopMarkerCardProps {
  users: string[];
  count: number;
  periodLabel: string;
}

function displayUser(user: string): string {
  const normalized = user.trim();
  if (!normalized) return 'Usuário não identificado';
  return normalized.includes('@') ? normalized.split('@')[0] : normalized;
}

export default function TopMarkerCard({ users, count, periodLabel }: TopMarkerCardProps) {
  const hasResult = users.length > 0 && count > 0;
  const isTie = users.length > 1;
  const title = !hasResult ? 'Marcações no período' : isTie ? 'Empate na liderança' : 'Usuário com mais marcações';
  const userNames = hasResult
    ? users.map(displayUser).join(' e ')
    : 'Nenhuma marcação no período';

  return (
    <section
      className="relative mb-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_45px_rgba(0,0,0,0.2)]"
      aria-label={title}
      aria-live="polite"
    >
      <div
        className={`absolute inset-y-0 left-0 w-1 ${hasResult ? 'bg-emerald' : 'bg-line-strong'}`}
        aria-hidden="true"
      />

      <div className="flex flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${
              hasResult
                ? 'border-emerald/30 bg-emerald/10'
                : 'border-line bg-surface-raised'
            }`}
            aria-hidden="true"
          >
            {hasResult ? (
              <Trophy className="h-5 w-5 text-emerald" />
            ) : (
              <UserRoundCheck className="h-5 w-5 text-subtle" />
            )}
          </div>

          <div className="min-w-0">
            <p
              className={`text-[0.6875rem] font-semibold uppercase tracking-[0.16em] ${
                hasResult ? 'text-emerald' : 'text-muted'
              }`}
            >
              {title}
            </p>
            <p
              className={`mt-1.5 break-words text-lg font-semibold leading-snug [overflow-wrap:anywhere] sm:text-xl ${
                hasResult ? 'text-ink' : 'text-muted'
              }`}
              title={hasResult ? users.join(', ') : undefined}
            >
              {userNames}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{periodLabel}</p>
          </div>
        </div>

        <div className="border-t border-line pt-4 sm:min-w-32 sm:border-l sm:border-t-0 sm:py-1 sm:pl-6 sm:text-right">
          <div
            className={`font-mono text-4xl font-semibold leading-none tabular-nums ${
              hasResult ? 'text-emerald' : 'text-subtle'
            }`}
          >
            {count}
          </div>
          <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
            {count === 1 ? 'OP marcada' : 'OPs marcadas'}
          </p>
        </div>
      </div>
    </section>
  );
}
