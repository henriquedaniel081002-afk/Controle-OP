import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { syncOPsWithExcel } from '../lib/supabase';
import { OPRecord } from '../types';

const EXPECTED_COLUMNS = [
  'OP-Pai',
  'Dt.Programada',
  'Referência Prod.',
  'Potência PA',
  'Linha Prod',
  'Nome Cliente',
  'Qtd.Programada',
  'Descr.Atividade'
];

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
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (!rows.length) {
        alert('Arquivo vazio ou sem dados para importar.');
        return;
      }

      const columns = Object.keys(rows[0] || {});
      const missingColumns = EXPECTED_COLUMNS.filter(col => !columns.includes(col));

      if (missingColumns.length > 0) {
        alert(
          `As seguintes colunas não foram encontradas no arquivo:\n\n${missingColumns.join('\n')}\n\nVerifique se o Excel exportado está no padrão correto.`
        );
        return;
      }

      const opsToInsert: Partial<OPRecord>[] = rows
        .map(item => {
          const linha = {
            op: limpar(item['OP-Pai']),
            data_programada: dataParaISO(item['Dt.Programada']),
            codigo_produto: limpar(item['Referência Prod.']),
            potencia: limpar(item['Potência PA']),
            linha: limpar(item['Linha Prod']),
            cliente: limpar(item['Nome Cliente']),
            qtde: numero(item['Qtd.Programada']),
            setor: limpar(item['Descr.Atividade'])
          };

          return {
            ...linha,
            status: 'pendente_impressao' as const,
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
        `Importação concluída.\n\nLinhas lidas no Excel: ${rows.length}\nLinhas válidas no Excel: ${opsToInsert.length}\nNovos registros incluídos: ${resultado.inserted.length}\nRegistros removidos do painel: ${resultado.deletedCount}\nRegistros iguais foram mantidos.`
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
