import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { fetchOPs, getSession, logout, updateOPMarcadoByOP, type AppSession } from './lib/api';
import { MarcacaoFiltro, OPRecord } from './types';
import Table from './components/Table';
import ExcelImport from './components/ExcelImport';
import Login from './components/Login';
import TopMarkerCard from './components/TopMarkerCard';
import { AlertCircle, CalendarDays, Factory, Loader2, LogOut, Search, User } from 'lucide-react';

function obterMesValor(data: string | null): string | null {
  if (!data) return null;
  const texto = String(data).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  return texto.slice(0, 7);
}


function normalizarMarcado(op: OPRecord): boolean {
  return Boolean(op.marcado) || op.status === 'impresso' || op.status === 'recolhido';
}

function obterUsuarioMarcacao(op: OPRecord): string | null {
  if (op.usuario_marcacao) return op.usuario_marcacao;
  if (op.status === 'recolhido') return op.usuario_recolhimento || op.usuario_impressao || null;
  if (op.status === 'impresso') return op.usuario_impressao || op.usuario_recolhimento || null;
  return null;
}

function obterDataMarcacao(op: OPRecord): string | null {
  if (op.data_marcacao) return op.data_marcacao;
  if (op.status === 'recolhido') return op.data_recolhimento || op.data_impressao || null;
  if (op.status === 'impresso') return op.data_impressao || op.data_recolhimento || null;
  return null;
}

function obterSemanaDoMes(data: string | null): number {
  const dia = Number(String(data || '').slice(8, 10)) || 1;
  return Math.max(1, Math.ceil(dia / 7));
}

function obterUltimoDiaDoMes(selectedMonth: string): number {
  const [ano, mes] = selectedMonth.split('-').map(Number);
  if (!ano || !mes) return 31;
  return new Date(ano, mes, 0).getDate();
}

function nomeMes(valor: string): string {
  const [ano, mes] = valor.split('-').map(Number);
  if (!ano || !mes) return valor;

  const data = new Date(ano, mes - 1, 1);
  return data.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric'
  });
}


export default function App() {
  const [ops, setOps] = useState<OPRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [updatingOP, setUpdatingOP] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<AppSession | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [markFilter, setMarkFilter] = useState<MarcacaoFiltro>('todos');
  const [selectedWeek, setSelectedWeek] = useState('todas');

  const usuarioAtual = session?.user?.email || 'Usuário';

  const loadData = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setLoadError(null);
      const data = await fetchOPs();
      setOps(data);
    } catch (error) {
      console.error(error);
      setLoadError('Erro ao carregar dados do Neon. Verifique a DATABASE_URL e a conexão com a API.');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    let active = true;

    getSession()
      .then((currentSession) => {
        if (active) setSession(currentSession);
      })
      .catch((error) => {
        console.error(error);
        if (active) setSession(null);
      })
      .finally(() => {
        if (active) setAuthLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    loadData();

    // Atualiza o painel periodicamente para refletir alterações feitas por outros usuários.
    const interval = window.setInterval(() => {
      fetchOPs()
        .then(setOps)
        .catch((error) => console.error('Falha na atualização periódica:', error));
    }, 30000);

    return () => window.clearInterval(interval);
  }, [session, loadData]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();

    for (const op of ops) {
      const month = obterMesValor(op.data_programada);
      if (month) months.add(month);
    }

    return Array.from(months)
      .sort()
      .map(value => ({ value, label: nomeMes(value) }));
  }, [ops]);

  const weekOptions = useMemo(() => {
    if (!selectedMonth) return [];
    const totalWeeks = Math.ceil(obterUltimoDiaDoMes(selectedMonth) / 7);
    return Array.from({ length: totalWeeks }, (_, index) => String(index + 1));
  }, [selectedMonth]);

  useEffect(() => {
    if (selectedWeek === 'todas') return;
    if (!weekOptions.includes(selectedWeek)) {
      setSelectedWeek('todas');
    }
  }, [selectedWeek, weekOptions]);

  useEffect(() => {
    if (monthOptions.length === 0) {
      setSelectedMonth('');
      return;
    }

    const exists = monthOptions.some(month => month.value === selectedMonth);
    if (exists) return;

    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const mesInicial = monthOptions.find(month => month.value === mesAtual)?.value || monthOptions[0].value;
    setSelectedMonth(mesInicial);
  }, [monthOptions, selectedMonth]);


  const topMarker = useMemo(() => {
    if (!selectedMonth) {
      return { users: [] as string[], count: 0, periodLabel: 'Nenhum período selecionado' };
    }

    const recordsDoPeriodo = ops.filter((record) => {
      if (String(record.data_programada || '').slice(0, 7) !== selectedMonth) return false;
      if (selectedWeek === 'todas') return true;
      return obterSemanaDoMes(record.data_programada) === Number(selectedWeek);
    });

    const recordsByOP = new Map<string, OPRecord[]>();
    for (const record of recordsDoPeriodo) {
      const op = String(record.op || '').trim();
      if (!op) continue;
      recordsByOP.set(op, [...(recordsByOP.get(op) || []), record]);
    }

    const counts = new Map<string, number>();

    for (const records of recordsByOP.values()) {
      if (!records.some(normalizarMarcado)) continue;

      const latestMark = records
        .map((record) => ({
          user: obterUsuarioMarcacao(record),
          date: obterDataMarcacao(record)
        }))
        .filter((mark) => mark.user)
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];

      const user = latestMark?.user?.trim();
      if (!user) continue;
      counts.set(user, (counts.get(user) || 0) + 1);
    }

    const highestCount = Math.max(0, ...counts.values());
    const users = Array.from(counts.entries())
      .filter(([, count]) => count === highestCount && highestCount > 0)
      .map(([user]) => user)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const monthLabel = nomeMes(selectedMonth);
    const periodLabel = selectedWeek === 'todas'
      ? `Resultado de ${monthLabel}`
      : `Resultado da Semana ${selectedWeek} de ${monthLabel}`;

    return { users, count: highestCount, periodLabel };
  }, [ops, selectedMonth, selectedWeek]);

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setSession(null);
      setOps([]);
      setQuickSearch('');
      setSelectedMonth('');
      setMarkFilter('todos');
      setSelectedWeek('todas');
    }
  };

  const handleToggleMarcado = async (op: string, marcado: boolean) => {
    if (!session || !op) return;

    const agora = new Date().toISOString();
    let snapshotAnterior: OPRecord[] = [];

    setUpdatingOP(op);

    setOps((prev) => {
      snapshotAnterior = prev;

      return prev.map((registro) => {
        if (String(registro.op || '').trim() !== op) return registro;

        return marcado
          ? {
              ...registro,
              marcado: true,
              data_marcacao: agora,
              usuario_marcacao: usuarioAtual,
              status: 'recolhido',
              data_recolhimento: agora,
              usuario_recolhimento: usuarioAtual
            }
          : {
              ...registro,
              marcado: false,
              data_marcacao: null,
              usuario_marcacao: null,
              status: 'pendente_impressao',
              data_impressao: null,
              usuario_impressao: null,
              data_recolhimento: null,
              usuario_recolhimento: null
            };
      });
    });

    try {
      const registrosAtualizados = await updateOPMarcadoByOP(op, marcado);

      if (Array.isArray(registrosAtualizados) && registrosAtualizados.length > 0) {
        const atualizadosPorId = new Map(
          (registrosAtualizados as OPRecord[]).map((registro) => [registro.id, registro])
        );

        setOps((prev) => prev.map((registro) => atualizadosPorId.get(registro.id) || registro));
      }
    } catch (e) {
      console.error(e);
      setOps(snapshotAnterior);
      alert('Erro ao atualizar marcação da OP. A alteração foi desfeita.');
    } finally {
      setUpdatingOP(null);
    }
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4 text-ink">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald/25 bg-emerald/10 text-emerald">
            <Factory className="h-6 w-6" aria-hidden="true" />
            <Loader2 className="absolute -inset-1 h-16 w-16 animate-spin text-emerald/40" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Controle de OP</p>
            <p className="mt-1 text-sm text-muted">Validando sua sessão...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={setSession} />;
  }

  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <a
        href="#main-content"
        className="sr-only z-[100] rounded-lg bg-emerald px-4 py-2 font-semibold text-on-accent focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>

      <header className="border-b border-line bg-surface/95 shadow-[0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-emerald/30 bg-emerald/10 text-emerald">
              <Factory className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-[0.12em] text-ink uppercase">Controle de OP</p>
              <p className="mt-0.5 text-xs text-muted">Gestão operacional de produção</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-line bg-canvas/45 px-3 text-sm text-muted">
              <User className="h-4 w-4 flex-shrink-0 text-emerald" aria-hidden="true" />
              <span className="truncate" title={usuarioAtual}>{usuarioAtual}</span>
            </div>
            <ExcelImport onImportComplete={loadData} />
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 text-sm font-semibold text-red-200 transition-colors hover:bg-danger/20"
              aria-label="Sair do sistema"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1600px] px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
        {loadError && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-red-100">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h2 className="font-semibold">Falha ao carregar dados</h2>
              <p className="mt-1 text-sm leading-6 text-red-100/80">{loadError}</p>
            </div>
          </div>
        )}

        <section className="mb-5" aria-labelledby="page-title">
          <p className="text-xs font-semibold tracking-[0.16em] text-emerald uppercase">Planejamento de produção</p>
          <h1 id="page-title" className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Painel operacional</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Consulte as ordens por mês e semana, acompanhe as marcações e encontre rapidamente cada OP.
          </p>
        </section>

        <section aria-labelledby="controls-title" className="mb-5 rounded-2xl border border-line bg-surface p-4 shadow-panel sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 id="controls-title" className="text-sm font-semibold text-ink">Pesquisa e filtros</h2>
              <p className="mt-1 text-xs text-muted">Refine a visualização das ordens de produção.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(180px,0.72fr)_minmax(360px,1.7fr)_minmax(180px,0.72fr)_auto] xl:items-start">
            <div>
              <label htmlFor="month-filter" className="mb-2 block text-xs font-semibold tracking-wide text-muted uppercase">Mês</label>
              <div className="flex min-h-11 items-center gap-2 rounded-xl border border-control bg-canvas/55 px-3 transition-colors focus-within:border-emerald/70">
                <CalendarDays className="h-4 w-4 flex-shrink-0 text-emerald" aria-hidden="true" />
                <select
                  id="month-filter"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="min-h-11 min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none capitalize"
                >
                  {monthOptions.length === 0 ? (
                    <option value="">Sem meses</option>
                  ) : (
                    monthOptions.map(month => (
                      <option key={month.value} value={month.value} className="capitalize">
                        {month.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="quick-search" className="mb-2 block text-xs font-semibold tracking-wide text-muted uppercase">Busca rápida</label>
              <div className="relative">
                <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
                <input
                  id="quick-search"
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Buscar OP, série, produto, potência, linha, cliente ou setor..."
                  className="min-h-11 w-full rounded-xl border border-control bg-canvas/55 py-2.5 pr-4 pl-10 text-sm text-ink outline-none transition-colors focus:border-emerald/70"
                  aria-describedby="quick-search-help"
                />
              </div>
              <p id="quick-search-help" className="mt-2 text-xs leading-5 text-subtle">
                Ex.: buscar 311026 encontra a OP cuja faixa de série é 311024 - 311123.
              </p>
            </div>

            <div>
              <label htmlFor="week-filter" className="mb-2 block text-xs font-semibold tracking-wide text-muted uppercase">Semana</label>
              <select
                id="week-filter"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-control bg-canvas/55 px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-emerald/70"
              >
                <option value="todas">Todas</option>
                {weekOptions.map(week => (
                  <option key={week} value={week}>
                    Semana {week}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className="mb-2 block text-xs font-semibold tracking-wide text-muted uppercase">Marcação</legend>
              <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-control bg-canvas/55 p-1">
                {([
                  ['todos', 'Todos'],
                  ['pendentes', 'Pendentes'],
                  ['marcados', 'Marcados']
                ] as [MarcacaoFiltro, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMarkFilter(value)}
                    aria-pressed={markFilter === value}
                    className={`min-h-11 rounded-lg px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                      markFilter === value
                        ? 'bg-emerald text-on-accent shadow-sm'
                        : 'text-muted hover:bg-white/5 hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        {!loading && (
          <TopMarkerCard
            users={topMarker.users}
            count={topMarker.count}
            periodLabel={topMarker.periodLabel}
          />
        )}

        {loading ? (
          <section role="status" aria-live="polite" aria-busy="true" className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel">
            <div className="flex items-center gap-3 border-b border-line bg-surface-raised/70 px-5 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-emerald" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-ink">Carregando ordens</p>
                <p className="mt-0.5 text-xs text-muted">Consultando os dados operacionais.</p>
              </div>
            </div>
            <div aria-hidden="true" className="space-y-3 p-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-surface-soft/80" />
              ))}
            </div>
          </section>
        ) : (
          <Table
            data={ops}
            selectedMonth={selectedMonth}
            quickSearch={quickSearch}
            markFilter={markFilter}
            selectedWeek={selectedWeek}
            onToggleMarcado={handleToggleMarcado}
            updatingOP={updatingOP}
          />
        )}
      </main>
    </div>
  );
}
