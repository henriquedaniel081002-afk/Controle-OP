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
      <div
        role="status"
        className="rounded-2xl border border-line bg-surface px-6 py-14 text-center shadow-panel"
      >
        <p className="text-sm font-semibold text-ink">Nenhum mês disponível</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Importe um arquivo Excel para carregar e visualizar as ordens de produção.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {semanas.map(semana => (
        <section
          key={semana.week}
          aria-labelledby={`semana-${semana.week}-titulo`}
          className="overflow-hidden rounded-2xl border border-line bg-surface shadow-panel"
        >
          <header className="border-b border-line bg-surface-raised px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h2
                    id={`semana-${semana.week}-titulo`}
                    className="text-sm font-bold uppercase tracking-[0.14em] text-ink"
                  >
                    Semana {semana.week}
                  </h2>
                  <span className="rounded-full border border-line-strong bg-canvas/60 px-2.5 py-1 text-xs font-medium text-muted">
                    {semana.inicio} a {semana.fim}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2" aria-label={`Resumo da semana ${semana.week}`}>
                  <span className="rounded-md border border-line-strong bg-canvas/45 px-2.5 py-1 text-xs text-muted">
                    <strong className="font-semibold text-ink">{semana.total}</strong> OPs
                  </span>
                  <span className="rounded-md border border-emerald/30 bg-emerald/10 px-2.5 py-1 text-xs text-muted">
                    <strong className="font-semibold text-emerald">{semana.marcadas}</strong> marcadas
                  </span>
                  <span className="rounded-md border border-info/30 bg-info/10 px-2.5 py-1 text-xs text-muted">
                    <strong className="font-semibold text-info">{semana.percentual}%</strong> marcadas
                  </span>
                </div>
              </div>

              <div className="w-full lg:max-w-xs">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted">
                  <span>Progresso de marcação</span>
                  <span className="tabular-nums text-ink">{semana.percentual}%</span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`Progresso de marcação da semana ${semana.week}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={semana.percentual}
                  className="h-2 overflow-hidden rounded-full bg-canvas ring-1 ring-inset ring-line"
                >
                  <div
                    className="h-full rounded-full bg-emerald transition-[width] duration-300 motion-reduce:transition-none"
                    style={{ width: `${semana.percentual}%` }}
                  />
                </div>
              </div>
            </div>
          </header>

          <div id={`semana-${semana.week}-registros`}>
            <div className="hidden xl:block">
              <div
                className="overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-label={`Tabela de ordens de produção da semana ${semana.week}`}
              >
                <table className="w-full min-w-[1220px] border-separate border-spacing-0 text-left text-xs text-detail">
                  <caption className="sr-only">
                    Ordens de produção da semana {semana.week}, de {semana.inicio} a {semana.fim}
                  </caption>
                  <thead className="sticky top-0 z-10 bg-canvas text-xs font-bold uppercase tracking-[0.08em] text-muted shadow-[inset_0_-1px_0_var(--color-line)]">
                    <tr>
                      <th scope="col" className="w-[68px] px-3 py-3 text-center">Marcação</th>
                      <th scope="col" className="min-w-[82px] px-2.5 py-3">OP</th>
                      <th scope="col" className="min-w-[124px] px-2.5 py-3">Série</th>
                      <th scope="col" className="min-w-[94px] px-2.5 py-3">Data</th>
                      <th scope="col" className="min-w-[106px] px-2.5 py-3">Código</th>
                      <th scope="col" className="min-w-[96px] px-2.5 py-3">Potência</th>
                      <th scope="col" className="min-w-[70px] px-2.5 py-3">Linha</th>
                      <th scope="col" className="min-w-[150px] px-2.5 py-3">Cliente</th>
                      <th scope="col" className="min-w-[62px] px-2.5 py-3 text-right">Qtd.</th>
                      <th scope="col" className="min-w-[88px] px-2.5 py-3">Setor</th>
                      <th scope="col" className="min-w-[132px] px-2.5 py-3">Data da marcação</th>
                      <th scope="col" className="min-w-[118px] px-2.5 py-3">Usuário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {semana.rows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-6 py-12 text-center">
                          <div className="mx-auto max-w-md">
                            <p className="font-semibold text-ink">Nenhuma OP nesta semana</p>
                            <p className="mt-1 text-sm text-muted">Não há resultados para os filtros selecionados.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      semana.rows
                        .slice(0, expandedWeeks[semana.week] ? semana.rows.length : limiteLinhasPorSemana)
                        .map(row => {
                        const isUpdating = updatingOP === row.op;

                        return (
                          <tr key={`${semana.week}-${row.op}`} className="group bg-surface transition-colors hover:bg-surface-raised motion-reduce:transition-none">
                            <td className="px-3 py-2.5 text-center align-middle">
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => onToggleMarcado(row.op, !row.marcado)}
                                aria-label={`${row.marcado ? 'Desmarcar' : 'Marcar'} OP ${row.op}`}
                                aria-pressed={row.marcado}
                                aria-busy={isUpdating}
                                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none ${
                                  row.marcado
                                    ? 'border-emerald/50 bg-emerald/15 text-emerald hover:bg-emerald/25'
                                    : 'border-control bg-canvas/60 text-muted hover:border-subtle hover:text-ink'
                                }`}
                                title={row.marcado ? 'Desmarcar OP' : 'Marcar OP'}
                              >
                                {isUpdating ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : row.marcado ? <CheckCircle2 aria-hidden="true" className="h-5 w-5" /> : <Circle aria-hidden="true" className="h-5 w-5" />}
                              </button>
                              {isUpdating && <span className="sr-only" role="status">Atualizando a marcação da OP {row.op}</span>}
                            </td>
                            <td className="px-2.5 py-3 align-middle" title={row.op}>
                              <div className="flex flex-col items-start gap-1.5">
                                <span className="font-mono text-sm font-bold text-ink">{row.op}</span>
                                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
                                  row.marcado
                                    ? 'border-emerald/40 bg-emerald/10 text-emerald'
                                    : 'border-warning/40 bg-warning/10 text-warning'
                                }`}>
                                  {row.marcado ? 'Marcada' : 'Pendente'}
                                </span>
                              </div>
                            </td>
                            <td className="px-2.5 py-3 align-middle" title={row.serie || ''}><div className="font-mono text-xs font-medium text-detail">{row.serie || '-'}</div></td>
                            <td className="px-2.5 py-3 align-middle" title={formatarData(row.dataBase)}><div className="whitespace-nowrap font-mono text-xs text-detail">{formatarData(row.dataBase)}</div></td>
                            <td className="px-2.5 py-3 align-middle" title={row.codigo_produto || ''}><div className="font-semibold text-ink">{row.codigo_produto || '-'}</div></td>
                            <td className="px-2.5 py-3 align-middle" title={row.potencia || ''}><div className="max-w-[116px] break-words font-mono leading-5 text-detail">{row.potencia || '-'}</div></td>
                            <td className="px-2.5 py-3 align-middle" title={row.linha || ''}><div className="text-detail">{row.linha || '-'}</div></td>
                            <td className="px-2.5 py-3 align-middle" title={row.cliente || ''}><div className="max-w-[180px] break-words leading-5 text-detail">{row.cliente || '-'}</div></td>
                            <td className="px-2.5 py-3 text-right align-middle" title={String(row.qtde ?? '')}><div className="font-mono text-sm font-semibold tabular-nums text-ink">{row.qtde}</div></td>
                            <td className="px-2.5 py-3 align-middle" title={row.setor || ''}>
                              <span className="inline-flex max-w-full break-words rounded-md border border-control bg-surface-raised px-2 py-1 text-xs font-semibold text-detail [overflow-wrap:anywhere]">{row.setor || '-'}</span>
                            </td>
                            <td className="px-2.5 py-3 align-middle" title={row.data_marcacao || ''}><div className="whitespace-nowrap text-xs text-detail">{row.marcado ? formatarDataHora(row.data_marcacao) : '-'}</div></td>
                            <td className="px-2.5 py-3 align-middle" title={row.usuario_marcacao || ''}><div className="max-w-[144px] break-words text-xs text-muted [overflow-wrap:anywhere]">{row.marcado ? row.usuario_marcacao || '-' : '-'}</div></td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="xl:hidden">
              {semana.rows.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="font-semibold text-ink">Nenhuma OP nesta semana</p>
                  <p className="mt-1 text-sm text-muted">Não há resultados para os filtros selecionados.</p>
                </div>
              ) : (
                <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:gap-4">
                  {semana.rows
                    .slice(0, expandedWeeks[semana.week] ? semana.rows.length : limiteLinhasPorSemana)
                    .map(row => {
                    const isUpdating = updatingOP === row.op;

                    return (
                      <article
                        key={`${semana.week}-${row.op}`}
                        aria-labelledby={`semana-${semana.week}-op-${row.op}`}
                        className={`max-w-full rounded-xl border p-4 shadow-lg [overflow-wrap:anywhere] ${
                          row.marcado ? 'border-emerald/35 bg-emerald/[0.045]' : 'border-line bg-canvas/45'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-line pb-4">
                          <div className="min-w-0">
                            <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold uppercase tracking-[0.08em] ${
                              row.marcado
                                ? 'border-emerald/40 bg-emerald/10 text-emerald'
                                : 'border-warning/40 bg-warning/10 text-warning'
                            }`}>
                              {row.marcado ? 'Marcada' : 'Pendente'}
                            </span>
                            <h3 id={`semana-${semana.week}-op-${row.op}`} className="mt-2 max-w-full break-words font-mono text-base font-bold text-ink [overflow-wrap:anywhere]" title={row.op}>OP {row.op}</h3>
                          </div>

                          <div className="shrink-0 text-center">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => onToggleMarcado(row.op, !row.marcado)}
                              aria-label={`${row.marcado ? 'Desmarcar' : 'Marcar'} OP ${row.op}`}
                              aria-pressed={row.marcado}
                              aria-busy={isUpdating}
                              className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none ${
                                row.marcado
                                  ? 'border-emerald/50 bg-emerald/15 text-emerald hover:bg-emerald/25'
                                  : 'border-control bg-surface text-muted hover:border-subtle hover:text-ink'
                              }`}
                              title={row.marcado ? 'Desmarcar OP' : 'Marcar OP'}
                            >
                              {isUpdating ? <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" /> : row.marcado ? <CheckCircle2 aria-hidden="true" className="h-5 w-5" /> : <Circle aria-hidden="true" className="h-5 w-5" />}
                            </button>
                            {isUpdating && <span className="sr-only" role="status">Atualizando a marcação da OP {row.op}</span>}
                          </div>
                        </div>

                        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                          <div className="col-span-2 max-w-full sm:col-span-1"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-subtle">Série</dt><dd className="mt-1 max-w-full break-words font-mono font-medium text-ink">{row.serie || '-'}</dd></div>
                          <div className="max-w-full"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-subtle">Data programada</dt><dd className="mt-1 whitespace-nowrap font-mono text-detail">{formatarData(row.dataBase)}</dd></div>
                          <div className="max-w-full"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-subtle">Código</dt><dd className="mt-1 max-w-full break-words font-semibold text-ink">{row.codigo_produto || '-'}</dd></div>
                          <div className="max-w-full"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-subtle">Potência</dt><dd className="mt-1 max-w-full break-words font-mono text-detail">{row.potencia || '-'}</dd></div>
                          <div className="max-w-full"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-subtle">Linha</dt><dd className="mt-1 max-w-full break-words text-detail">{row.linha || '-'}</dd></div>
                          <div className="col-span-2 max-w-full"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-subtle">Cliente</dt><dd className="mt-1 max-w-full break-words leading-5 text-detail">{row.cliente || '-'}</dd></div>
                          <div className="max-w-full"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-subtle">Quantidade</dt><dd className="mt-1 font-mono text-base font-bold tabular-nums text-ink">{row.qtde}</dd></div>
                          <div className="max-w-full"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-subtle">Setor</dt><dd className="mt-1 max-w-full"><span className="inline-flex max-w-full whitespace-normal break-words rounded-md border border-control bg-surface-raised px-2 py-1 text-xs font-semibold text-detail [overflow-wrap:anywhere]">{row.setor || '-'}</span></dd></div>
                          <div className="col-span-2 max-w-full border-t border-line pt-4 sm:col-span-1"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-subtle">Data da marcação</dt><dd className="mt-1 max-w-full break-words text-xs text-detail">{row.marcado ? formatarDataHora(row.data_marcacao) : '-'}</dd></div>
                          <div className="col-span-2 max-w-full border-t border-line pt-4 sm:col-span-1"><dt className="text-xs font-bold uppercase tracking-[0.08em] text-subtle">Usuário</dt><dd className="mt-1 max-w-full break-words text-xs text-muted">{row.marcado ? row.usuario_marcacao || '-' : '-'}</dd></div>
                        </dl>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {semana.rows.length > limiteLinhasPorSemana && (
            <div className="flex justify-center border-t border-line bg-canvas/45 px-4 py-3">
              <button
                type="button"
                onClick={() => setExpandedWeeks(prev => ({ ...prev, [semana.week]: !prev[semana.week] }))}
                aria-expanded={Boolean(expandedWeeks[semana.week])}
                aria-controls={`semana-${semana.week}-registros`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald/45 bg-emerald/10 px-5 py-2 text-xs font-bold text-emerald transition-colors hover:bg-emerald/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-reduce:transition-none"
              >
                {expandedWeeks[semana.week]
                  ? 'Ver menos'
                  : `Ver mais (${semana.rows.length - limiteLinhasPorSemana})`}
              </button>
            </div>
          )}
        </section>
      ))}

      <footer className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>Fonte de dados: <strong className="font-semibold text-detail">Neon PostgreSQL</strong></span>
        <span><strong className="font-semibold tabular-nums text-ink">{totalGeral}</strong> OPs exibidas com os filtros selecionados</span>
      </footer>
    </div>
  );
}
