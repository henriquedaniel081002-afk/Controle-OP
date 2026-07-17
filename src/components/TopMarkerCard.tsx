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
  const title = isTie ? 'Empate na liderança' : 'Usuário com mais marcações';
  const userNames = hasResult
    ? users.map(displayUser).join(' e ')
    : 'Nenhuma marcação no período';

  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-[#00EE76]/20 bg-gradient-to-r from-[#00EE76]/10 via-white/[0.04] to-transparent">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[#00EE76]/20 bg-[#00EE76]/10">
            {hasResult ? (
              <Trophy className="h-5 w-5 text-[#00EE76]" />
            ) : (
              <UserRoundCheck className="h-5 w-5 text-slate-500" />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00EE76]">
              {title}
            </p>
            <p
              className={`mt-1 truncate text-lg font-bold ${hasResult ? 'text-white' : 'text-slate-400'}`}
              title={hasResult ? users.join(', ') : undefined}
            >
              {userNames}
            </p>
            <p className="mt-1 text-xs text-slate-500">{periodLabel}</p>
          </div>
        </div>

        <div className="sm:text-right">
          <div className={`font-mono text-3xl font-bold ${hasResult ? 'text-[#00EE76]' : 'text-slate-600'}`}>
            {count}
          </div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            {count === 1 ? 'OP marcada' : 'OPs marcadas'}
          </p>
        </div>
      </div>
    </section>
  );
}
