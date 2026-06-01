import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase, fetchOPs, updateOPMarcadoByOP } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { MarcacaoFiltro, OPRecord } from './types';
import Table from './components/Table';
import ExcelImport from './components/ExcelImport';
import Login from './components/Login';
import { AlertCircle, CalendarDays, LogOut, Search, User } from 'lucide-react';

function obterMesValor(data: string | null): string | null {
  if (!data) return null;
  const texto = String(data).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  return texto.slice(0, 7);
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
  const [session, setSession] = useState<Session | null>(null);
  const [quickSearch, setQuickSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [markFilter, setMarkFilter] = useState<MarcacaoFiltro>('todos');
  const [selectedWeek, setSelectedWeek] = useState('todas');

  const isSupabaseConfigured = !!supabase;
  const usuarioAtual = session?.user?.email || 'Usuário';

  const loadData = useCallback(async () => {
    if (!isSupabaseConfigured || !session) {
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
      setLoadError('Erro ao carregar dados do Supabase. Verifique a URL, chave pública, RLS e conexão.');
    } finally {
      setLoading(false);
    }
  }, [isSupabaseConfigured, session]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      if (!currentSession) {
        setOps([]);
        setQuickSearch('');
        setSelectedMonth('');
        setMarkFilter('todos');
        setSelectedWeek('todas');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [isSupabaseConfigured]);

  useEffect(() => {
    if (!session) return;

    loadData();

    if (isSupabaseConfigured) {
      const subscription = supabase
        .channel('registro_op_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registro_op' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setOps((prev) => [payload.new as OPRecord, ...prev].sort((a, b) => b.id - a.id));
          } else if (payload.eventType === 'UPDATE') {
            setOps((prev) => prev.map((op) => op.id === payload.new.id ? payload.new as OPRecord : op));
          } else if (payload.eventType === 'DELETE') {
            setOps((prev) => prev.filter((op) => op.id !== payload.old.id));
          }
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [isSupabaseConfigured, session, loadData]);

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

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const handleToggleMarcado = async (op: string, marcado: boolean) => {
    if (!isSupabaseConfigured || !op) return;

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
      const registrosAtualizados = await updateOPMarcadoByOP(op, marcado, usuarioAtual);

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
      <div className="min-h-screen bg-[#0a0a0a] text-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00EE76]"></div>
      </div>
    );
  }

  if (!session) {
    return <Login onLoginSuccess={loadData} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {!isSupabaseConfigured && (
          <div className="mb-6 bg-orange-500/10 border border-orange-500/20 text-orange-400 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold">Supabase não configurado</h4>
              <p className="text-sm opacity-80 mt-1">
                Configure as variáveis <code className="bg-black/30 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> e <code className="bg-black/30 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> no seu painel para conectar ao banco de dados.
              </p>
            </div>
          </div>
        )}

        {loadError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-300 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold">Falha ao carregar dados</h4>
              <p className="text-sm opacity-80 mt-1">{loadError}</p>
            </div>
          </div>
        )}

        <header className="flex flex-col gap-4 mb-6 border-b border-white/10 pb-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-8 bg-[#00EE76] rounded-full hidden md:block"></div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase">Painel Operacional</h1>
                <p className="text-xs text-slate-500 mt-1">Controle mensal por semanas e marcação única por OP</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300">
                <User className="w-4 h-4 text-[#00EE76]" />
                <span className="max-w-[220px] truncate" title={usuarioAtual}>{usuarioAtual}</span>
              </div>
              <ExcelImport onImportComplete={loadData} />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 px-4 py-2 rounded text-sm transition-all"
              >
                <LogOut className="w-4 h-4" />
                Sair
              </button>
            </div>
          </div>
        </header>

        <div className="mb-4 bg-white/5 p-3 rounded-lg border border-white/10">
          <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr_250px_auto] gap-3 xl:items-start">
            <label className="flex items-center gap-2 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300">
              <CalendarDays className="w-4 h-4 text-[#00EE76]" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-transparent outline-none text-slate-100 capitalize"
              >
                {monthOptions.length === 0 ? (
                  <option value="">Sem meses</option>
                ) : (
                  monthOptions.map(month => (
                    <option key={month.value} value={month.value} className="bg-[#111] text-slate-100 capitalize">
                      {month.label}
                    </option>
                  ))
                )}
              </select>
            </label>

            <div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  placeholder="Buscar OP, série, produto, potência, linha, cliente ou setor..."
                  className="w-full bg-[#111] border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:border-[#00EE76]"
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Ex.: buscar 311026 encontra a OP cuja faixa de série é 311024 - 311123.
              </p>
            </div>

            <label className="flex items-center gap-2 bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300">
              <span className="text-slate-500">Semana</span>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="w-full bg-transparent outline-none text-slate-100"
              >
                <option value="todas" className="bg-[#111] text-slate-100">Todas</option>
                {weekOptions.map(week => (
                  <option key={week} value={week} className="bg-[#111] text-slate-100">
                    Semana {week}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex rounded-lg overflow-hidden border border-white/10 bg-[#111] h-[38px]">
              {([
                ['todos', 'Todos'],
                ['pendentes', 'Pendentes'],
                ['marcados', 'Marcados']
              ] as [MarcacaoFiltro, string][]).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setMarkFilter(value)}
                  className={`px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                    markFilter === value
                      ? 'bg-[#00EE76] text-black'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64 border border-gray-800 rounded-xl bg-gray-900/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00EE76]"></div>
          </div>
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
      </div>
    </div>
  );
}
