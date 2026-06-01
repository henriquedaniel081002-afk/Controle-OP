import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
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

export default function ExcelImport({ onImportComplete }: { onImportComplete: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = React.useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });

      if (!rawRows.length) {
        alert('Arquivo vazio ou sem dados para importar.');
        return;
      }

      const headerRowIndex = rawRows.findIndex(row => {
        const columnsCandidate = row.map(col => limpar(col));
        return resolverColunas(columnsCandidate).missing.length === 0;
      });

      if (headerRowIndex === -1) {
        const expectedColumns = COLUMN_DEFINITIONS.map(column => column.label).join('\n');
        alert(
          `Não encontrei a linha de cabeçalho do Excel.\n\nColunas esperadas:\n${expectedColumns}\n\nVerifique se o arquivo exportado está no padrão correto.`
        );
        return;
      }

      const columns = rawRows[headerRowIndex].map(col => limpar(col));
      const { resolved, missing } = resolverColunas(columns);

      if (missing.length > 0) {
        alert(
          `As seguintes colunas não foram encontradas no arquivo:\n\n${missing.join('\n')}\n\nVerifique se o Excel exportado está no padrão correto.`
        );
        return;
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
        alert('Nenhuma linha válida encontrada. Verifique os dados do Excel, principalmente OP e Dt.Programada.');
        return;
      }

      const resultado = await syncOPsWithExcel(opsToInsert);
      onImportComplete();

      alert(
        `Importação concluída.\n\nLinhas lidas no Excel: ${rows.length}\nLinhas válidas no Excel: ${opsToInsert.length}\nRegistros únicos sincronizados: ${resultado.validUniqueCount}\nNovos registros incluídos: ${resultado.insertedCount}\nRegistros existentes atualizados/preservados: ${resultado.updatedCount}\nRegistros removidos do painel: ${resultado.deletedCount}\n\nAs marcações existentes foram preservadas.`
      );
    } catch (err) {
      console.error(err);
      alert('Erro ao importar o arquivo. Verifique o console para mais detalhes.');
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
    </>
  );
}
