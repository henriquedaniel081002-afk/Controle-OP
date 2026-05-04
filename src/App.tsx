import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase, fetchOPs, updateOPStatus, updateOPStatusByOP } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { OPRecord, OPFilters, OPStatus } from './types';
import Cards from './components/Cards';
import Table from './components/Table';
import Filters from './components/Filters';
import ExcelImport from './components/ExcelImport';
import Login from './components/Login';
import { AlertCircle, LogOut, User } from 'lucide-react';

export default function App() {
  const [ops, setOps] = useState<OPRecord[]>([]);
  const [filters, setFilters] = useState<OPFilters>({});
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

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
        setFilters({});
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

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  const filteredOps = useMemo(() => {
    return ops.filter(op => {
      if (filters.op && !String(op.op || '').toLowerCase().includes(filters.op.toLowerCase())) return false;
      if (filters.cliente && !String(op.cliente || '').toLowerCase().includes(filters.cliente.toLowerCase())) return false;
      if (filters.linha && !String(op.linha || '').toLowerCase().includes(filters.linha.toLowerCase())) return false;
      if (filters.setor && !String(op.setor || '').toLowerCase().includes(filters.setor.toLowerCase())) return false;
      if (filters.status && op.status !== filters.status) return false;
      if (filters.dataInicial || filters.dataFinal) {
        if (!op.data_programada) return false;

        const dataProgramada = String(op.data_programada).slice(0, 10);
        if (filters.dataInicial && dataProgramada < filters.dataInicial) return false;
        if (filters.dataFinal && dataProgramada > filters.dataFinal) return false;
      }
      return true;
    });
  }, [ops, filters]);

  const handleUpdateStatus = async (id: number, status: OPStatus) => {
    if (!isSupabaseConfigured) return;

    const registroSelecionado = ops.find((op) => op.id === id);

    setIsUpdating(id);
    try {
      if (registroSelecionado?.op && (status === 'impresso' || status === 'pendente_impressao')) {
        await updateOPStatusByOP(registroSelecionado.op, status, usuarioAtual);
        return;
      }

      await updateOPStatus(id, status, usuarioAtual);
    } catch (e) {
      alert('Erro ao atualizar OP');
    } finally {
      setIsUpdating(null);
    }
  };

  const total = filteredOps.length;
  const pendentes = filteredOps.filter(o => o.status === 'pendente_impressao').length;
  const impressas = filteredOps.filter(o => o.status === 'impresso').length;
  const recolhidas = filteredOps.filter(o => o.status === 'recolhido').length;

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
              <h1 className="text-xl md:text-2xl font-bold tracking-tight uppercase">Painel Operacional</h1>
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

        <Cards 
          total={total}
          pendentes={pendentes}
          impressas={impressas}
          recolhidas={recolhidas}
        />

        <div className="flex justify-end mb-4 bg-white/5 p-3 rounded-lg border border-white/10">
          <button 
            onClick={() => setIsFiltersOpen(true)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded text-sm font-medium transition-all relative whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
            Filtros Avançados
            {Object.values(filters).filter(Boolean).length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#00EE76] rounded-full ring-2 ring-[#0a0a0a]"></span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64 border border-gray-800 rounded-xl bg-gray-900/50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00EE76]"></div>
          </div>
        ) : (
          <Table 
            data={filteredOps} 
            onUpdateStatus={handleUpdateStatus} 
            isUpdating={isUpdating} 
          />
        )}
      </div>

      {isFiltersOpen && (
        <Filters 
          filters={filters} 
          onChange={setFilters} 
          onClose={() => setIsFiltersOpen(false)} 
        />
      )}
    </div>
  );
}
