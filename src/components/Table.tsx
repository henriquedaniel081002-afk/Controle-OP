import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { OPRecord, OPStatus } from '../types';

interface TableProps {
  data: OPRecord[];
  onUpdateStatus: (id: number, status: OPStatus) => void;
  isUpdating: number | null;
}

type SortDirection = 'asc' | 'desc';
type SortKey = keyof OPRecord;

const columns: { key: SortKey; label: string; align?: 'left' | 'right' | 'center'; width?: string }[] = [
  { key: 'op', label: 'OP' },
  { key: 'data_programada', label: 'Data Programada' },
  { key: 'codigo_produto', label: 'Código' },
  { key: 'potencia', label: 'Potência' },
  { key: 'linha', label: 'Linha' },
  { key: 'cliente', label: 'Cliente', width: 'min-w-[260px]' },
  { key: 'qtde', label: 'Qtde', align: 'right' },
  { key: 'setor', label: 'Setor' },
  { key: 'status', label: 'Status' }
];

function normalizarValor(valor: unknown): string | number {
  if (valor === undefined || valor === null) return '';
  if (typeof valor === 'number') return valor;

  const texto = String(valor).trim();
  const numero = Number(texto.replace(',', '.'));
  if (texto !== '' && !Number.isNaN(numero) && /^-?\d+(?:[.,]\d+)?$/.test(texto)) return numero;

  return texto.toLowerCase();
}

function formatarData(valor: string | null): string {
  if (!valor) return '-';
  const [ano, mes, dia] = String(valor).slice(0, 10).split('-');
  if (!ano || !mes || !dia) return valor;
  return `${dia}/${mes}/${ano}`;
}

export default function Table({ data, onUpdateStatus, isUpdating }: TableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('data_programada');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortKey(key);
    setSortDirection('asc');
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const valorA = normalizarValor(a[sortKey]);
      const valorB = normalizarValor(b[sortKey]);

      if (valorA < valorB) return sortDirection === 'asc' ? -1 : 1;
      if (valorA > valorB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDirection]);

  const getStatusBadge = (status: OPRecord['status']) => {
    switch(status) {
      case 'pendente_impressao':
        return <span className="text-[10px] px-2 py-0.5 rounded border border-amber-500 text-amber-500 bg-amber-500/10 uppercase">PENDENTE</span>;
      case 'impresso':
        return <span className="text-[10px] px-2 py-0.5 rounded border border-blue-400 text-blue-400 bg-blue-400/10 uppercase">IMPRESSO</span>;
      case 'recolhido':
        return <span className="text-[10px] px-2 py-0.5 rounded border border-[#00EE76] text-[#00EE76] bg-[#00EE76]/10 uppercase">RECOLHIDO</span>;
      default:
        return null;
    }
  };

  const ActionButton = ({ children, onClick, variant = 'default', disabled = false }: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'green' | 'outline';
    disabled?: boolean;
  }) => {
    const classes = {
      default: 'bg-white text-black hover:bg-white/90',
      green: 'bg-[#00EE76] text-black hover:bg-[#00EE76]/90',
      outline: 'bg-transparent text-slate-300 border border-white/15 hover:bg-white/10'
    }[variant];

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`text-[10px] font-bold px-3 py-1 rounded transition-all disabled:opacity-50 ${classes}`}
      >
        {children}
      </button>
    );
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-[#00EE76]" /> : <ArrowDown className="w-3 h-3 text-[#00EE76]" />;
  };

  return (
    <div className="flex-1 border border-white/10 rounded-lg bg-black/20 flex flex-col overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full table-auto text-left border-collapse min-w-[1180px]">
          <thead className="bg-white/5 border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              {columns.map(column => (
                <th key={column.key} className={`px-3 py-3 ${column.width || ''} ${column.align === 'right' ? 'text-right' : ''}`}>
                  <button
                    onClick={() => handleSort(column.key)}
                    className={`inline-flex items-center gap-1 hover:text-white transition-colors ${column.align === 'right' ? 'justify-end w-full' : ''}`}
                    title={`Ordenar por ${column.label}`}
                  >
                    {column.label}
                    <SortIcon column={column.key} />
                  </button>
                </th>
              ))}
              <th className="px-3 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-12 text-center text-slate-500 whitespace-normal text-sm">
                  Nenhuma OP encontrada com os filtros atuais.
                </td>
              </tr>
            ) : (
              sortedData.map((item) => {
                let opColor = 'text-slate-300';
                if (item.status === 'recolhido') opColor = 'text-[#00EE76]';
                if (item.status === 'impresso') opColor = 'text-blue-400';
                if (item.status === 'pendente_impressao') opColor = 'text-amber-400';

                return (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors items-center group">
                    <td className="px-3 py-3 align-middle whitespace-nowrap" title={String(item.op || '')}>
                      <div className={`font-mono text-sm font-semibold ${opColor}`}>{item.op}</div>
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap" title={formatarData(item.data_programada)}>
                      <div className="text-sm font-mono text-slate-200">{formatarData(item.data_programada)}</div>
                    </td>
                    <td className="px-3 py-3 align-middle max-w-[160px]" title={item.codigo_produto || ''}>
                      <div className="text-sm font-medium whitespace-normal break-words leading-snug">{item.codigo_produto}</div>
                    </td>
                    <td className="px-3 py-3 align-middle max-w-[110px]" title={item.potencia || ''}>
                      <div className="text-sm font-mono text-slate-300 whitespace-normal break-words leading-snug">{item.potencia}</div>
                    </td>
                    <td className="px-3 py-3 align-middle max-w-[120px]" title={item.linha || ''}>
                      <div className="text-sm text-slate-300 whitespace-normal break-words leading-snug">{item.linha}</div>
                    </td>
                    <td className="px-3 py-3 align-middle min-w-[260px] max-w-[360px]" title={item.cliente || ''}>
                      <div className="text-sm text-slate-300 whitespace-normal break-words leading-snug">{item.cliente}</div>
                    </td>
                    <td className="px-3 py-3 align-middle text-right whitespace-nowrap" title={String(item.qtde ?? '')}>
                      <div className="text-sm font-mono pr-4 text-slate-200">{item.qtde}</div>
                    </td>
                    <td className="px-3 py-3 align-middle max-w-[190px]" title={item.setor || ''}>
                      <div className="text-xs bg-slate-800 px-2 py-1 rounded w-fit max-w-full text-slate-300 whitespace-normal break-words leading-snug">{item.setor}</div>
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap" title={item.status}>
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="px-3 py-3 align-middle text-center min-w-[190px]">
                      <div className="flex flex-wrap justify-center gap-2">
                        {item.status === 'pendente_impressao' && (
                          <ActionButton onClick={() => onUpdateStatus(item.id, 'impresso')} disabled={isUpdating === item.id}>
                            Marcar Impressa
                          </ActionButton>
                        )}
                        {item.status === 'impresso' && (
                          <>
                            <ActionButton onClick={() => onUpdateStatus(item.id, 'recolhido')} disabled={isUpdating === item.id} variant="green">
                              Marcar Recolhida
                            </ActionButton>
                            <ActionButton onClick={() => onUpdateStatus(item.id, 'pendente_impressao')} disabled={isUpdating === item.id} variant="outline">
                              Desmarcar Impressa
                            </ActionButton>
                          </>
                        )}
                        {item.status === 'recolhido' && (
                          <>
                            <span className="text-[10px] text-slate-500 italic self-center">Finalizado</span>
                            <ActionButton onClick={() => onUpdateStatus(item.id, 'impresso')} disabled={isUpdating === item.id} variant="outline">
                              Desmarcar Recolhida
                            </ActionButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 bg-white/5 flex items-center justify-between text-[10px] text-slate-500 border-t border-white/10 mt-auto">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-[#00EE76] rounded-full"></span> Sistema Conectado (Supabase)
          </span>
        </div>
        <div>Mostrando {sortedData.length} registros</div>
      </div>
    </div>
  );
}
