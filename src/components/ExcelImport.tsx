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
    default: 'border-line bg-surface-raised text-ink',
    green: 'border-emerald/35 bg-emerald/10 text-emerald',
    red: 'border-danger/35 bg-danger/10 text-danger',
    blue: 'border-info/35 bg-info/10 text-info'
  }[tone];

  return (
    <div className={`rounded-xl border p-3.5 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const STEP_STATUS_LABELS: Record<ImportStepStatus, string> = {
  pendente: 'Pendente',
  processando: 'Em processamento',
  concluido: 'Concluída',
  erro: 'Interrompida por erro'
};

export default function ExcelImport({ onImportComplete }: { onImportComplete: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);
  const [showModal, setShowModal] = React.useState(false);
  const [steps, setSteps] = React.useState<ImportStep[]>(criarEtapas());
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!showModal) return;

    const animationFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      triggerButtonRef.current?.focus();
    };
  }, [showModal]);

  React.useEffect(() => {
    if (!showModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showModal]);

  const announcedStep = steps.find((step) => step.status === 'processando' || step.status === 'erro');
  const statusAnnouncement = announcedStep
    ? `${announcedStep.label}: ${STEP_STATUS_LABELS[announcedStep.status]}.`
    : errorMessage
      ? 'Importação interrompida.'
      : summary
        ? 'Sincronização concluída.'
        : isImporting
          ? 'Importação em andamento.'
          : 'Processamento finalizado.';

  const setStepStatus = (key: ImportStepKey, status: ImportStepStatus) => {
    setSteps((current) => atualizarEtapa(current, key, status));
  };

  const startStep = (key: ImportStepKey) => setStepStatus(key, 'processando');
  const finishStep = (key: ImportStepKey) => setStepStatus(key, 'concluido');

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!isImporting) setShowModal(false);
      return;
    }

    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements: HTMLElement[] = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      )
    ) as HTMLElement[];

    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && (document.activeElement === firstElement || document.activeElement === dialog)) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  };

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
        ref={triggerButtonRef}
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isImporting}
        aria-haspopup="dialog"
        aria-expanded={showModal}
        aria-controls="excel-import-dialog"
        aria-busy={isImporting}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-control bg-surface-raised px-4 py-2.5 text-sm font-semibold text-ink shadow-sm transition-colors hover:border-subtle hover:bg-surface-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-wait disabled:opacity-60"
      >
        <Upload className="h-4 w-4 text-emerald" aria-hidden="true" />
        {isImporting ? 'Importando...' : 'Importar Excel'}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/85 p-3 backdrop-blur-sm sm:p-6">
          <div
            id="excel-import-dialog"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="excel-import-title"
            aria-describedby="excel-import-description"
            aria-busy={isImporting}
            tabIndex={-1}
            onKeyDown={handleDialogKeyDown}
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-line bg-surface text-ink shadow-dialog outline-none sm:max-h-[calc(100dvh-3rem)]"
          >
            <span id="excel-import-description" className="sr-only">
              Acompanhe cada etapa da atualização das ordens de produção.
            </span>
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {statusAnnouncement}
            </p>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface/95 p-4 backdrop-blur-xl sm:p-6">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-emerald/25 bg-emerald/10 text-emerald sm:h-12 sm:w-12">
                  <FileSpreadsheet className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald">
                    Sincronização de dados
                  </p>
                  <h3 id="excel-import-title" className="mt-1 text-lg font-semibold tracking-tight text-ink sm:text-xl">Importação do Excel</h3>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Acompanhe as etapas e o resumo da atualização do banco de dados.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isImporting && setShowModal(false)}
                disabled={isImporting}
                aria-label={isImporting ? 'Aguarde a importação terminar para fechar' : 'Fechar importação'}
                className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald disabled:cursor-not-allowed disabled:opacity-40"
                title={isImporting ? 'Aguarde a importação terminar' : 'Fechar'}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-6 p-4 sm:p-6">
              <section aria-labelledby="import-steps-title">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4 id="import-steps-title" className="text-sm font-semibold text-ink">
                      Etapas da sincronização
                    </h4>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      O processo começa automaticamente após a seleção do arquivo.
                    </p>
                  </div>
                  <p className="text-xs font-medium text-muted">
                    {isImporting
                      ? 'Importação em andamento'
                      : errorMessage
                        ? 'Importação interrompida'
                        : summary
                          ? 'Sincronização concluída'
                          : 'Processamento finalizado'}
                  </p>
                </div>

                <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {steps.map((step, index) => {
                    const isActive = step.status === 'processando';
                    const isComplete = step.status === 'concluido';
                    const hasError = step.status === 'erro';

                    return (
                      <li
                        key={step.key}
                        aria-current={isActive ? 'step' : undefined}
                        className={`relative rounded-xl border p-4 ${
                          isActive
                            ? 'border-info/55 bg-info/10'
                            : isComplete
                              ? 'border-emerald/35 bg-emerald/[0.07]'
                              : hasError
                                ? 'border-danger/45 bg-danger/10'
                                : 'border-line bg-surface-raised/70'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg border text-xs font-bold ${
                              isActive
                                ? 'border-info/45 bg-info/15 text-info'
                                : isComplete
                                  ? 'border-emerald/35 bg-emerald/15 text-emerald'
                                  : hasError
                                    ? 'border-danger/40 bg-danger/15 text-danger'
                                    : 'border-line-strong bg-surface text-muted'
                            }`}
                            aria-hidden="true"
                          >
                            {isComplete && <CheckCircle2 className="h-4 w-4" />}
                            {isActive && <Loader2 className="h-4 w-4 animate-spin" />}
                            {hasError && <AlertCircle className="h-4 w-4" />}
                            {step.status === 'pendente' && index + 1}
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                            Etapa {index + 1} de {steps.length}
                          </span>
                        </div>
                        <p className="mt-4 text-sm font-semibold leading-5 text-ink">{step.label}</p>
                        <p className="mt-1.5 text-xs leading-5 text-muted">{step.description}</p>
                        <p
                          className={`mt-3 text-xs font-semibold ${
                            isActive
                              ? 'text-info'
                              : isComplete
                                ? 'text-emerald'
                                : hasError
                                  ? 'text-danger'
                                  : 'text-subtle'
                          }`}
                        >
                          {STEP_STATUS_LABELS[step.status]}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </section>

              {errorMessage && (
                <div
                  role="alert"
                  className="rounded-xl border border-danger/35 bg-danger/10 p-4 text-danger"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">Erro na importação</p>
                      <p className="mt-1 text-sm opacity-90">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              {summary && (
                <div className="space-y-5" role="region" aria-labelledby="import-summary-title">
                  <h4 id="import-summary-title" className="sr-only">Resumo da importação</h4>
                  <div className="rounded-xl border border-emerald/35 bg-emerald/10 p-4 text-emerald sm:p-5">
                    <p className="font-semibold">Importação concluída com sucesso.</p>
                    <p className="mt-1 text-sm leading-6 text-detail">
                      O banco foi sincronizado com o Excel usando a OP como chave. Marcações existentes foram preservadas.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatCard label="Linhas lidas" value={summary.totalRows} />
                    <StatCard label="Linhas válidas" value={summary.validRows} />
                    <StatCard label="OPs únicas" value={summary.uniqueRecords} />
                    <StatCard label="Marcações preservadas" value={summary.preservedMarkedCount} tone="green" />
                    <StatCard label="Adicionadas" value={summary.insertedCount} tone="green" />
                    <StatCard label="Atualizadas" value={summary.updatedCount} tone="blue" />
                    <StatCard label="Removidas" value={summary.removedFromExcelCount} tone="red" />
                    <StatCard label="Duplicadas apagadas" value={summary.duplicateRemovedCount} tone="red" />
                  </div>

                  <div className="rounded-xl border border-line bg-canvas/45 p-4 sm:p-5">
                    <h4 className="mb-3 text-sm font-semibold text-ink">Detalhamento da sincronização</h4>
                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-lg border border-line bg-surface-raised/75 p-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald">OPs adicionadas</p>
                        <p className="mt-1.5 break-words leading-6 text-detail">{formatarListaOPs(summary.opsAdicionadas)}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-surface-raised/75 p-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-info">OPs atualizadas</p>
                        <p className="mt-1.5 break-words leading-6 text-detail">{formatarListaOPs(summary.opsAtualizadas)}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-surface-raised/75 p-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-danger">OPs removidas por não estarem no Excel</p>
                        <p className="mt-1.5 break-words leading-6 text-detail">{formatarListaOPs(summary.opsRemovidas)}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-surface-raised/75 p-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-danger">OPs duplicadas apagadas</p>
                        <p className="mt-1.5 break-words leading-6 text-detail">{formatarListaOPs(summary.opsDuplicadasRemovidas)}</p>
                      </div>
                      <div className="rounded-lg border border-line bg-surface-raised/75 p-3.5 md:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald">OPs que mantiveram marcação</p>
                        <p className="mt-1.5 break-words leading-6 text-detail">{formatarListaOPs(summary.opsMarcadasPreservadas, 20)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald px-5 py-2.5 text-sm font-semibold text-on-accent shadow-sm transition-colors hover:bg-emerald-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
