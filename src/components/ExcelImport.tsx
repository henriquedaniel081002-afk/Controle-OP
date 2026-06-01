import React, { useRef } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { syncOPsWithExcel } from '../lib/supabase';
import { OPRecord } from '../types';

type ColumnKey =
  | 'op'
  | 'dataProgramada'
  | 'codigoProduto'
  | 'potencia'
  | 'linha'
  | 'cliente'
  | 'qtde'
  | 'setor'
  | 'serieInicial'
  | 'serieFinal';

const COLUMN_DEFINITIONS: { key: ColumnKey; label: string; aliases: string[] }[] = [
  { key: 'op', label: 'OP-Pai', aliases: ['OP-Pai', 'OP Pai', 'OP'] },
  { key: 'dataProgramada', label: 'Dt.Programada', aliases: ['Dt.Programada', 'Dt Programada', 'Data Programada'] },
  { key: 'codigoProduto', label: 'Referência Prod.', aliases: ['Referência Prod.', 'Referencia Prod.', 'Referência Produto', 'Referencia Produto'] },
  { key: 'potencia', label: 'Potência PA', aliases: ['Potência PA', 'Potencia PA'] },
  { key: 'linha', label: 'Linha Prod', aliases: ['Linha Prod', 'Linha Produto'] },
  { key: 'cliente', label: 'Nome Cliente', aliases: ['Nome Cliente', 'Cliente'] },
  { key: 'qtde', label: 'Qtd.Programada', aliases: ['Qtd.Programada', 'Qtd Programada', 'Quantidade Programada'] },
  { key: 'setor', label: 'Descr.Atividade', aliases: ['Descr.Atividade', 'Descr Atividade', 'Descrição Atividade', 'Descricao Atividade'] },
  { key: 'serieInicial', label: 'Série Inicial', aliases: ['Série Inicial', 'Serie Inicial'] },
  { key: 'serieFinal', label: 'Série Final', aliases: ['Série Final', 'Serie Final'] }
];

function normalizarTexto(valor: string): string {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function resolverColunas(columns: string[]): { resolved: Record<ColumnKey, string>; missing: string[] } {
  const normalizedMap = new Map<string, string>();

  for (const col of columns) {
    normalizedMap.set(normalizarTexto(col), col);
  }

  const resolved = {} as Record<ColumnKey, string>;
  const missing: string[] = [];

  for (const definition of COLUMN_DEFINITIONS) {
    const found = definition.aliases
      .map(alias => normalizedMap.get(normalizarTexto(alias)))
      .find(Boolean);

    if (found) {
      resolved[definition.key] = found;
    } else {
      missing.push(definition.label);
    }
  }

  return { resolved, missing };
}

function limpar(valor: unknown): string {
  if (valor === undefined || valor === null) return '';
  return String(valor).trim();
}

function numero(valor: unknown): number {
  if (valor === undefined || valor === null || valor === '') return 0;

  const texto = String(valor)
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  return Number(texto) || 0;
}

function numeroOuNull(valor: unknown): number | null {
  if (valor === undefined || valor === null || valor === '') return null;
  const valorNumerico = numero(valor);
  return Number.isFinite(valorNumerico) && valorNumerico !== 0 ? valorNumerico : null;
}

function textoSerie(valor: unknown): string {
  const texto = limpar(valor);
  if (!texto) return '';

  const numeroSerie = numeroOuNull(valor);
  if (numeroSerie !== null) {
    return String(numeroSerie);
  }

  return texto;
}

function montarSerie(inicial: unknown, final: unknown): string | null {
  const serieInicial = textoSerie(inicial);
  const serieFinal = textoSerie(final);

  if (serieInicial && serieFinal) return `${serieInicial} - ${serieFinal}`;
  if (serieInicial) return serieInicial;
  if (serieFinal) return serieFinal;
  return null;
}

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

function excelSerialParaISO(valor: number): string {
  const utcDays = Math.floor(valor - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  const year = dateInfo.getUTCFullYear();
  const month = doisDigitos(dateInfo.getUTCMonth() + 1);
  const day = doisDigitos(dateInfo.getUTCDate());
  return `${year}-${month}-${day}`;
}

function dataParaISO(valor: unknown): string | null {
  if (valor === undefined || valor === null || valor === '') return null;

  if (typeof valor === 'number') {
    return excelSerialParaISO(valor);
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getFullYear()}-${doisDigitos(valor.getMonth() + 1)}-${doisDigitos(valor.getDate())}`;
  }

  const texto = String(valor).trim();
  if (!texto) return null;

  const isoMatch = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = texto.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (brMatch) {
    const dia = doisDigitos(Number(brMatch[1]));
    const mes = doisDigitos(Number(brMatch[2]));
    const ano = brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3];
    return `${ano}-${mes}-${dia}`;
  }

  const date = new Date(texto);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${doisDigitos(date.getMonth() + 1)}-${doisDigitos(date.getDate())}`;
  }

  return null;
}

function gerarChave(linha: Pick<OPRecord, 'op' | 'data_programada' | 'qtde' | 'setor'>): string {
  return [
    linha.op,
    linha.data_programada || '',
    linha.qtde,
    linha.setor
  ].join('|');
}

type ImportStepKey = 'leitura' | 'validacao' | 'comparacao' | 'banco' | 'finalizacao';
type ImportStepStatus = 'pendente' | 'processando' | 'concluido' | 'erro';

type ImportStep = {
  key: ImportStepKey;
  label: string;
  description: string;
  status: ImportStepStatus;
};

type ImportSummary = {
  fileName: string;
  totalRows: number;
  validRows: number;
  uniqueRecords: number;
  insertedCount: number;
  updatedCount: number;
  deletedCount: number;
  removedFromExcelCount: number;
  duplicateRemovedCount: number;
  preservedMarkedCount: number;
  opsAdicionadas: string[];
  opsAtualizadas: string[];
  opsRemovidas: string[];
  opsDuplicadasRemovidas: string[];
  opsMarcadasPreservadas: string[];
};

const STEP_LABELS: Record<ImportStepKey, { label: string; description: string }> = {
  leitura: {
    label: 'Lendo arquivo Excel',
    description: 'Abrindo a planilha e identificando a aba principal.'
  },
  validacao: {
    label: 'Validando dados',
    description: 'Localizando cabeçalhos e convertendo linhas válidas.'
  },
  comparacao: {
    label: 'Comparando OPs',
    description: 'Comparando as OPs do Excel com os registros do Supabase.'
  },
  banco: {
    label: 'Atualizando banco de dados',
    description: 'Adicionando, atualizando e removendo registros conforme a regra por OP.'
  },
  finalizacao: {
    label: 'Finalizando importação',
    description: 'Atualizando o painel e montando o resumo da sincronização.'
  }
};

function criarEtapas(): ImportStep[] {
  return (Object.keys(STEP_LABELS) as ImportStepKey[]).map((key) => ({
    key,
    label: STEP_LABELS[key].label,
    description: STEP_LABELS[key].description,
    status: 'pendente'
  }));
}

function atualizarEtapa(
  steps: ImportStep[],
  key: ImportStepKey,
  status: ImportStepStatus
): ImportStep[] {
  return steps.map((step) => step.key === key ? { ...step, status } : step);
}

function formatarListaOPs(ops: string[], limite = 10): string {
  if (!ops.length) return 'Nenhuma';
  const amostra = ops.slice(0, limite).join(', ');
  const restante = ops.length - limite;
  return restante > 0 ? `${amostra} + ${restante} outras` : amostra;
}

function StatCard({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'green' | 'red' | 'blue' }) {
  const toneClass = {
    default: 'border-white/10 bg-white/5 text-slate-100',
    green: 'border-[#00EE76]/30 bg-[#00EE76]/10 text-[#00EE76]',
    red: 'border-red-400/30 bg-red-500/10 text-red-300',
    blue: 'border-sky-400/30 bg-sky-500/10 text-sky-300'
  }[tone];

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

export default function ExcelImport({ onImportComplete }: { onImportComplete: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [steps, setSteps] = React.useState<ImportStep[]>(criarEtapas());
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const progressPercent = React.useMemo(() => {
    const concluidas = steps.filter(step => step.status === 'concluido').length;
    const processando = steps.some(step => step.status === 'processando') ? 0.5 : 0;
    return Math.min(100, Math.round(((concluidas + processando) / steps.length) * 100));
  }, [steps]);

  const setStepStatus = (key: ImportStepKey, status: ImportStepStatus) => {
    setSteps((current) => atualizarEtapa(current, key, status));
  };

  const startStep = (key: ImportStepKey) => setStepStatus(key, 'processando');
  const finishStep = (key: ImportStepKey) => setStepStatus(key, 'concluido');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setShowModal(true);
    setSummary(null);
    setErrorMessage(null);
    setSteps(criarEtapas());

    try {
      startStep('leitura');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      finishStep('leitura');

      if (!rawRows.length) {
        throw new Error('Arquivo vazio ou sem dados para importar.');
      }

      startStep('validacao');
      const headerRowIndex = rawRows.findIndex(row => {
        const columnsCandidate = row.map(col => limpar(col));
        return resolverColunas(columnsCandidate).missing.length === 0;
      });

      if (headerRowIndex === -1) {
        const expectedColumns = COLUMN_DEFINITIONS.map(column => column.label).join(', ');
        throw new Error(`Não encontrei a linha de cabeçalho do Excel. Colunas esperadas: ${expectedColumns}.`);
      }

      const columns = rawRows[headerRowIndex].map(col => limpar(col));
      const { resolved, missing } = resolverColunas(columns);

      if (missing.length > 0) {
        throw new Error(`As seguintes colunas não foram encontradas no arquivo: ${missing.join(', ')}.`);
      }

      const rows: Record<string, unknown>[] = rawRows
        .slice(headerRowIndex + 1)
        .map(row => {
          const item: Record<string, unknown> = {};
          columns.forEach((column, index) => {
            if (column) item[column] = row[index] ?? '';
          });
          return item;
        });

      const opsToInsert: Partial<OPRecord>[] = rows
        .map(item => {
          const linha = {
            op: limpar(item[resolved.op]),
            data_programada: dataParaISO(item[resolved.dataProgramada]),
            codigo_produto: limpar(item[resolved.codigoProduto]),
            potencia: limpar(item[resolved.potencia]),
            linha: limpar(item[resolved.linha]),
            cliente: limpar(item[resolved.cliente]),
            qtde: numero(item[resolved.qtde]),
            setor: limpar(item[resolved.setor]),
            serie_inicial: numeroOuNull(item[resolved.serieInicial]),
            serie_final: numeroOuNull(item[resolved.serieFinal]),
            serie: montarSerie(item[resolved.serieInicial], item[resolved.serieFinal])
          };

          return {
            ...linha,
            status: 'pendente_impressao' as const,
            marcado: false,
            data_marcacao: null,
            usuario_marcacao: null,
            chave_importacao: gerarChave(linha)
          };
        })
        .filter(op => op.op && op.data_programada && op.setor && op.qtde !== undefined && op.chave_importacao !== '||0|');

      if (opsToInsert.length === 0) {
        throw new Error('Nenhuma linha válida encontrada. Verifique os dados do Excel, principalmente OP e Dt.Programada.');
      }
      finishStep('validacao');

      startStep('comparacao');
      await new Promise(resolve => setTimeout(resolve, 150));
      finishStep('comparacao');

      startStep('banco');
      const resultado = await syncOPsWithExcel(opsToInsert);
      finishStep('banco');

      startStep('finalizacao');
      await onImportComplete();
      setSummary({
        fileName: file.name,
        totalRows: rows.length,
        validRows: opsToInsert.length,
        uniqueRecords: resultado.validUniqueCount,
        insertedCount: resultado.insertedCount,
        updatedCount: resultado.updatedCount,
        deletedCount: resultado.deletedCount,
        removedFromExcelCount: resultado.removedFromExcelCount || 0,
        duplicateRemovedCount: resultado.duplicateRemovedCount || 0,
        preservedMarkedCount: resultado.preservedMarkedCount || 0,
        opsAdicionadas: resultado.opsAdicionadas || [],
        opsAtualizadas: resultado.opsAtualizadas || [],
        opsRemovidas: resultado.opsRemovidas || [],
        opsDuplicadasRemovidas: resultado.opsDuplicadasRemovidas || [],
        opsMarcadasPreservadas: resultado.opsMarcadasPreservadas || []
      });
      finishStep('finalizacao');
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Erro ao importar o arquivo. Verifique o console para mais detalhes.';
      setErrorMessage(message);
      setSteps((current) => current.map((step) => step.status === 'processando' ? { ...step, status: 'erro' } : step));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <input
        type="file"
        accept=".xlsx, .xls, .csv"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileUpload}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded text-sm transition-all disabled:opacity-50"
      >
        <Upload className="w-4 h-4" />
        {isImporting ? 'Importando...' : 'Importar Excel'}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0f1115] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0f1115]/95 p-5 backdrop-blur">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[#00EE76]/10 p-3 text-[#00EE76]">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Importação do Excel</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Acompanhe o progresso e o resumo da atualização do banco de dados.
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isImporting && setShowModal(false)}
                disabled={isImporting}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                title={isImporting ? 'Aguarde a importação terminar' : 'Fechar'}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-slate-300">Progresso geral</span>
                  <span className="font-semibold text-[#00EE76]">{progressPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#00EE76] transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                {steps.map((step) => (
                  <div key={step.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      {step.status === 'concluido' && <CheckCircle2 className="h-4 w-4 text-[#00EE76]" />}
                      {step.status === 'processando' && <Loader2 className="h-4 w-4 animate-spin text-sky-300" />}
                      {step.status === 'erro' && <AlertCircle className="h-4 w-4 text-red-300" />}
                      {step.status === 'pendente' && <div className="h-4 w-4 rounded-full border border-white/20" />}
                      <span className="text-xs font-semibold text-slate-100">{step.label}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500">{step.description}</p>
                  </div>
                ))}
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Erro na importação</p>
                      <p className="mt-1 text-sm opacity-90">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {summary && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-[#00EE76]/20 bg-[#00EE76]/10 p-4 text-[#00EE76]">
                    <p className="font-semibold">Importação concluída com sucesso.</p>
                    <p className="mt-1 text-sm text-slate-300">
                      O banco foi sincronizado com o Excel usando a OP como chave. Marcações existentes foram preservadas.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <StatCard label="Linhas lidas" value={summary.totalRows} />
                    <StatCard label="Linhas válidas" value={summary.validRows} />
                    <StatCard label="OPs únicas" value={summary.uniqueRecords} />
                    <StatCard label="Marcações preservadas" value={summary.preservedMarkedCount} tone="green" />
                    <StatCard label="Adicionadas" value={summary.insertedCount} tone="green" />
                    <StatCard label="Atualizadas" value={summary.updatedCount} tone="blue" />
                    <StatCard label="Removidas" value={summary.removedFromExcelCount} tone="red" />
                    <StatCard label="Duplicadas apagadas" value={summary.duplicateRemovedCount} tone="red" />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <h4 className="mb-3 text-sm font-semibold text-slate-200">Detalhamento da sincronização</h4>
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-lg bg-black/20 p-3">
                        <p className="text-xs font-semibold uppercase text-[#00EE76]">OPs adicionadas</p>
                        <p className="mt-1 text-slate-300">{formatarListaOPs(summary.opsAdicionadas)}</p>
                      </div>
                      <div className="rounded-lg bg-black/20 p-3">
                        <p className="text-xs font-semibold uppercase text-sky-300">OPs atualizadas</p>
                        <p className="mt-1 text-slate-300">{formatarListaOPs(summary.opsAtualizadas)}</p>
                      </div>
                      <div className="rounded-lg bg-black/20 p-3">
                        <p className="text-xs font-semibold uppercase text-red-300">OPs removidas por não estarem no Excel</p>
                        <p className="mt-1 text-slate-300">{formatarListaOPs(summary.opsRemovidas)}</p>
                      </div>
                      <div className="rounded-lg bg-black/20 p-3">
                        <p className="text-xs font-semibold uppercase text-red-300">OPs duplicadas apagadas</p>
                        <p className="mt-1 text-slate-300">{formatarListaOPs(summary.opsDuplicadasRemovidas)}</p>
                      </div>
                      <div className="rounded-lg bg-black/20 p-3 md:col-span-2">
                        <p className="text-xs font-semibold uppercase text-[#00EE76]">OPs que mantiveram marcação</p>
                        <p className="mt-1 text-slate-300">{formatarListaOPs(summary.opsMarcadasPreservadas, 20)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowModal(false)}
                      className="rounded-lg bg-[#00EE76] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#00d96a]"
                    >
                      Fechar resumo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
