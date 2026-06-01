import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { MarcacaoFiltro, OPRecord } from '../types';

interface TableProps {
  data: OPRecord[];
  selectedMonth: string;
  quickSearch: string;
  markFilter: MarcacaoFiltro;
  selectedWeek: string;
  onToggleMarcado: (op: string, marcado: boolean) => void;
  updatingOP: string | null;
}

interface OPResumo {
  op: string;
  dataBase: string | null;
  codigo_produto: string;
  potencia: string;
  linha: string;
  cliente: string;
  qtde: number;
  setor: string;
  serie: string | null;
  serieInicial: number | null;
  serieFinal: number | null;
  marcado: boolean;
  data_marcacao: string | null;
  usuario_marcacao: string | null;
  week: number;
  searchText: string;
}

interface SemanaResumo {
  week: number;
  inicio: string;
  fim: string;
  total: number;
  marcadas: number;
  percentual: number;
  rows: OPResumo[];
}


function normalizarNumeroSerie(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const somenteNumeros = String(valor).replace(/\D/g, '');
  if (!somenteNumeros) return null;
  const numero = Number(somenteNumeros);
  return Number.isFinite(numero) ? numero : null;
}

function obterIntervaloSerie(records: OPRecord[]): { inicio: number | null; fim: number | null } {
  const seriesIniciais = records
    .map(record => normalizarNumeroSerie(record.serie_inicial))
    .filter((valor): valor is number => valor !== null);

  const seriesFinais = records
    .map(record => normalizarNumeroSerie(record.serie_final))
    .filter((valor): valor is number => valor !== null);

  if (seriesIniciais.length === 0 && seriesFinais.length === 0) {
    return { inicio: null, fim: null };
  }

  const todosNumeros = [...seriesIniciais, ...seriesFinais];
  const inicio = seriesIniciais.length > 0 ? Math.min(...seriesIniciais) : Math.min(...todosNumeros);
  const fim = seriesFinais.length > 0 ? Math.max(...seriesFinais) : Math.max(...todosNumeros);

  return {
    inicio: Math.min(inicio, fim),
    fim: Math.max(inicio, fim)
  };
}

function buscaEstaNoIntervaloSerie(search: string, inicio: number | null, fim: number | null): boolean {
  const numeroBuscado = normalizarNumeroSerie(search);
  if (numeroBuscado === null || inicio === null || fim === null) return false;
  return numeroBuscado >= inicio && numeroBuscado <= fim;
}

function formatarData(valor: string | null): string {
  if (!valor) return '-';
  const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

function formatarDataHora(valor: string | null): string {
  if (!valor) return '-';

  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return formatarData(valor);
  }

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizarMarcado(op: OPRecord): boolean {
  return Boolean(op.marcado) || op.status === 'impresso' || op.status === 'recolhido';
}

function dataMarcacaoNormalizada(op: OPRecord): string | null {
  if (op.data_marcacao) return op.data_marcacao;
  if (op.status === 'recolhido') return op.data_recolhimento || op.data_impressao || null;
  if (op.status === 'impresso') return op.data_impressao || op.data_recolhimento || null;
  return null;
}

function usuarioMarcacaoNormalizado(op: OPRecord): string | null {
  if (op.usuario_marcacao) return op.usuario_marcacao;
  if (op.status === 'recolhido') return op.usuario_recolhimento || op.usuario_impressao || null;
  if (op.status === 'impresso') return op.usuario_impressao || op.usuario_recolhimento || null;
  return null;
}

function obterDia(valor: string | null): number {
  if (!valor) return 1;
  return Number(String(valor).slice(8, 10)) || 1;
}

function obterSemanaDoMes(valor: string | null): number {
  const dia = obterDia(valor);
  return Math.max(1, Math.ceil(dia / 7));
}

function obterUltimoDiaDoMes(selectedMonth: string): number {
  const [ano, mes] = selectedMonth.split('-').map(Number);
  if (!ano || !mes) return 31;
  return new Date(ano, mes, 0).getDate();
}

function montarPeriodoSemana(selectedMonth: string, week: number): { inicio: string; fim: string } {
  const lastDay = obterUltimoDiaDoMes(selectedMonth);
  const startDay = ((week - 1) * 7) + 1;
  const endDay = Math.min(week * 7, lastDay);
  const [ano, mes] = selectedMonth.split('-');

  return {
    inicio: `${String(startDay).padStart(2, '0')}/${mes}/${ano}`,
    fim: `${String(endDay).padStart(2, '0')}/${mes}/${ano}`
  };
}

function montarSerieAgrupada(records: OPRecord[], representante: OPRecord): string | null {
  const intervalo = obterIntervaloSerie(records);

  if (intervalo.inicio !== null || intervalo.fim !== null) {
    const inicio = intervalo.inicio ?? intervalo.fim;
    const fim = intervalo.fim ?? intervalo.inicio;

    if (inicio === fim) return String(inicio);
    return `${inicio} - ${fim}`;
  }

  const seriesTextuais = Array.from(new Set(records.map(record => record.serie).filter(Boolean))) as string[];
  if (seriesTextuais.length > 0) return seriesTextuais.join(', ');

  return representante.serie || null;
}

function montarResumoPorOP(records: OPRecord[]): OPResumo | null {
  const recordsOrdenados = [...records].sort((a, b) => String(a.data_programada || '').localeCompare(String(b.data_programada || '')));
  const representante = recordsOrdenados[0];

  if (!representante) return null;

  const marcado = records.some(normalizarMarcado);
  const registrosComMarcacao = records
    .map(record => ({
      data: dataMarcacaoNormalizada(record),
      usuario: usuarioMarcacaoNormalizado(record)
    }))
    .filter(info => info.data)
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const dataMarcacao = marcado ? registrosComMarcacao[0]?.data || null : null;
  const usuarioMarcacao = marcado ? registrosComMarcacao[0]?.usuario || null : null;
  const qtdeTotal = records.reduce((total, record) => total + Number(record.qtde || 0), 0);
  const intervaloSerie = obterIntervaloSerie(records);

  return {
    op: representante.op,
    dataBase: representante.data_programada,
    codigo_produto: representante.codigo_produto,
    potencia: representante.potencia,
    linha: representante.linha,
    cliente: representante.cliente,
    qtde: qtdeTotal,
    setor: representante.setor,
    serie: montarSerieAgrupada(records, representante),
    serieInicial: intervaloSerie.inicio,
    serieFinal: intervaloSerie.fim,
    marcado,
    data_marcacao: dataMarcacao,
    usuario_marcacao: usuarioMarcacao,
    week: obterSemanaDoMes(representante.data_programada),
    searchText: records.map(record => [
      record.op,
      record.codigo_produto,
      record.potencia,
      record.linha,
      record.cliente,
      record.setor,
      record.qtde,
      record.data_programada,
      record.serie,
      record.serie_inicial,
      record.serie_final,
      normalizarMarcado(record) ? 'marcado' : 'pendente'
    ].join(' ')).join(' ')
  };
}

export default function Table({ data, selectedMonth, quickSearch, markFilter, selectedWeek, onToggleMarcado, updatingOP }: TableProps) {
  const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setExpandedWeeks({});
  }, [selectedMonth, quickSearch, markFilter, selectedWeek]);

  const semanas = useMemo<SemanaResumo[]>(() => {
    if (!selectedMonth) return [];

    const recordsDoMes = data.filter(record => String(record.data_programada || '').slice(0, 7) === selectedMonth);
    const byOP = new Map<string, OPRecord[]>();

    for (const record of recordsDoMes) {
      const op = String(record.op || '').trim();
      if (!op) continue;
      byOP.set(op, [...(byOP.get(op) || []), record]);
    }

    const search = quickSearch.trim().toLowerCase();

    const rows = Array.from(byOP.values())
      .map(montarResumoPorOP)
      .filter((row): row is OPResumo => Boolean(row))
      .filter(row => {
        if (!search) return true;

        if (buscaEstaNoIntervaloSerie(search, row.serieInicial, row.serieFinal)) {
          return true;
        }

        const searchableFields = [
          row.op,
          row.serie,
          row.dataBase,
          row.codigo_produto,
          row.potencia,
          row.linha,
          row.cliente,
          row.qtde,
          row.setor,
          row.marcado ? 'marcado' : 'pendente',
          row.searchText
        ].join(' ').toLowerCase();

        return searchableFields.includes(search);
      })
      .filter(row => {
        if (markFilter === 'marcados') return row.marcado;
        if (markFilter === 'pendentes') return !row.marcado;
        return true;
      })
      .sort((a, b) => {
        const dataCompare = String(a.dataBase || '').localeCompare(String(b.dataBase || ''));
        if (dataCompare !== 0) return dataCompare;
        return String(a.op || '').localeCompare(String(b.op || ''));
      });

    const totalWeeks = Math.ceil(obterUltimoDiaDoMes(selectedMonth) / 7);

    return Array.from({ length: totalWeeks }, (_, index) => {
      const week = index + 1;
      const periodo = montarPeriodoSemana(selectedMonth, week);
      const rowsDaSemana = rows.filter(row => row.week === week);
      const marcadas = rowsDaSemana.filter(row => row.marcado).length;
      const total = rowsDaSemana.length;
      const percentual = total > 0 ? Math.round((marcadas / total) * 100) : 0;

      return {
        week,
        inicio: periodo.inicio,
        fim: periodo.fim,
        total,
        marcadas,
        percentual,
        rows: rowsDaSemana
      };
    }).filter(semana => selectedWeek === 'todas' || semana.week === Number(selectedWeek));
  }, [data, selectedMonth, quickSearch, markFilter, selectedWeek]);

  const totalGeral = semanas.reduce((total, semana) => total + semana.total, 0);
  const limiteLinhasPorSemana = 15;

  if (!selectedMonth) {
    return (
      <div className="border border-white/10 rounded-lg bg-black/20 p-10 text-center text-sm text-slate-500">
        Nenhum mês disponível para exibição. Importe um Excel para carregar as OPs.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {semanas.map(semana => (
        <section key={semana.week} className="border border-white/10 rounded-xl bg-black/20 overflow-hidden">
          <div className="bg-white/[0.04] border-b border-white/10 px-4 py-3">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white">Semana {semana.week}</h2>
                  <span className="text-[11px] text-slate-500">{semana.inicio} a {semana.fim}</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {semana.total} OPs · {semana.marcadas} marcadas · {semana.percentual}% concluído
                </div>
              </div>

              <div className="min-w-[220px]">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Progresso</span>
                  <span>{semana.percentual}%</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#00EE76] rounded-full transition-all" style={{ width: `${semana.percentual}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="w-full overflow-hidden">
            <table className="w-full table-fixed text-left border-collapse text-[12px]">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[6%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[6%]" />
                <col className="w-[18%]" />
                <col className="w-[7%]" />
                <col className="w-[8%]" />
                <col className="w-[7%]" />
                <col className="w-[5%]" />
              </colgroup>
              <thead className="bg-black/30 border-b border-white/10 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-3 text-center">Marcado</th>
                  <th className="px-2 py-3">OP</th>
                  <th className="px-2 py-3">Série</th>
                  <th className="px-2 py-3">Data</th>
                  <th className="px-2 py-3">Código</th>
                  <th className="px-2 py-3">Potência</th>
                  <th className="px-2 py-3">Linha</th>
                  <th className="px-2 py-3">Cliente</th>
                  <th className="px-2 py-3 text-right">Qtd.</th>
                  <th className="px-2 py-3">Setor</th>
                  <th className="px-2 py-3">Marcado</th>
                  <th className="px-2 py-3">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {semana.rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-8 text-center text-slate-600 text-sm">
                      Nenhuma OP nesta semana para o filtro atual.
                    </td>
                  </tr>
                ) : (
                  semana.rows
                    .slice(0, expandedWeeks[semana.week] ? semana.rows.length : limiteLinhasPorSemana)
                    .map(row => {
                    const isUpdating = updatingOP === row.op;

                    return (
                      <tr key={`${semana.week}-${row.op}`} className="hover:bg-white/[0.025] transition-colors">
                        <td className="px-2 py-2 text-center align-middle">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => onToggleMarcado(row.op, !row.marcado)}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all disabled:opacity-60 ${
                              row.marcado
                                ? 'bg-[#00EE76]/15 border-[#00EE76]/40 text-[#00EE76] hover:bg-[#00EE76]/25'
                                : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:bg-white/10'
                            }`}
                            title={row.marcado ? 'Desmarcar OP' : 'Marcar OP'}
                          >
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : row.marcado ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-2 py-2 align-middle truncate" title={row.op}>
                          <div className={`font-mono text-[12px] font-semibold truncate ${row.marcado ? 'text-[#00EE76]' : 'text-amber-400'}`}>{row.op}</div>
                        </td>
                        <td className="px-2 py-2 align-middle truncate" title={row.serie || ''}>
                          <div className="font-mono text-[12px] text-slate-200 truncate">{row.serie || '-'}</div>
                        </td>
                        <td className="px-2 py-2 align-middle truncate" title={formatarData(row.dataBase)}>
                          <div className="font-mono text-[12px] text-slate-200 truncate">{formatarData(row.dataBase)}</div>
                        </td>
                        <td className="px-2 py-2 align-middle truncate" title={row.codigo_produto || ''}>
                          <div className="text-[12px] font-medium truncate">{row.codigo_produto || '-'}</div>
                        </td>
                        <td className="px-2 py-2 align-middle" title={row.potencia || ''}>
                          <div className="font-mono text-[12px] text-slate-300 leading-tight line-clamp-2 break-words">{row.potencia || '-'}</div>
                        </td>
                        <td className="px-2 py-2 align-middle truncate" title={row.linha || ''}>
                          <div className="text-[12px] text-slate-300 truncate">{row.linha || '-'}</div>
                        </td>
                        <td className="px-2 py-2 align-middle" title={row.cliente || ''}>
                          <div className="text-[12px] text-slate-300 leading-tight line-clamp-2 break-words">{row.cliente || '-'}</div>
                        </td>
                        <td className="px-2 py-2 align-middle text-right truncate" title={String(row.qtde ?? '')}>
                          <div className="font-mono text-[12px] text-slate-200">{row.qtde}</div>
                        </td>
                        <td className="px-2 py-2 align-middle" title={row.setor || ''}>
                          <div className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300 leading-tight line-clamp-2 break-words">{row.setor || '-'}</div>
                        </td>
                        <td className="px-2 py-2 align-middle truncate" title={row.data_marcacao || ''}>
                          <div className="text-[11px] text-slate-300 truncate">{row.marcado ? formatarDataHora(row.data_marcacao) : '-'}</div>
                        </td>
                        <td className="px-2 py-2 align-middle truncate" title={row.usuario_marcacao || ''}>
                          <div className="text-[11px] text-slate-400 truncate">{row.marcado ? row.usuario_marcacao || '-' : '-'}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {semana.rows.length > limiteLinhasPorSemana && (
              <div className="flex justify-center border-t border-white/10 bg-black/20 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpandedWeeks(prev => ({ ...prev, [semana.week]: !prev[semana.week] }))}
                  className="rounded-lg border border-[#00EE76]/40 px-4 py-2 text-xs font-semibold text-[#00EE76] transition-all hover:bg-[#00EE76]/10"
                >
                  {expandedWeeks[semana.week]
                    ? 'Ver menos'
                    : `Ver mais (${semana.rows.length - limiteLinhasPorSemana})`}
                </button>
              </div>
            )}
          </div>
        </section>
      ))}

      <div className="p-3 bg-white/5 flex items-center justify-between text-[10px] text-slate-500 border border-white/10 rounded-lg">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-[#00EE76] rounded-full"></span> Sistema Conectado (Supabase)
        </span>
        <span>{totalGeral} OPs exibidas no mês selecionado</span>
      </div>
    </div>
  );
}
