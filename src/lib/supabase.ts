import { createClient } from '@supabase/supabase-js';
import type { OPRecord, OPStatus } from '../types';

const SUPABASE_URL_FALLBACK = 'https://afjjyzrwfpmmbfezafhr.supabase.co';
const SUPABASE_ANON_KEY_FALLBACK = 'sb_publishable_nJf7M0iOVmwWwiXyPCY30g_HQESIsTW';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK).trim();
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY_FALLBACK).trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your environment variables.');
}

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function statusLegadoEhMarcado(status?: OPStatus | null): boolean {
  return status === 'impresso' || status === 'recolhido';
}

function obterMarcacaoPreservada(registro?: Partial<OPRecord>) {
  if (!registro) {
    return {
      marcado: false,
      data_marcacao: null,
      usuario_marcacao: null
    };
  }

  const marcado = Boolean(registro.marcado) || statusLegadoEhMarcado(registro.status as OPStatus | null);

  if (!marcado) {
    return {
      marcado: false,
      data_marcacao: null,
      usuario_marcacao: null
    };
  }

  const dataLegado = registro.status === 'recolhido'
    ? (registro.data_recolhimento || registro.data_impressao)
    : (registro.data_impressao || registro.data_recolhimento);

  const usuarioLegado = registro.status === 'recolhido'
    ? (registro.usuario_recolhimento || registro.usuario_impressao)
    : (registro.usuario_impressao || registro.usuario_recolhimento);

  return {
    marcado: true,
    data_marcacao: registro.data_marcacao || dataLegado || null,
    usuario_marcacao: registro.usuario_marcacao || usuarioLegado || null
  };
}

function normalizarRegistroParaNovoModelo(registro: OPRecord): OPRecord {
  const marcacao = obterMarcacaoPreservada(registro);

  return {
    ...registro,
    serie_inicial: registro.serie_inicial ?? null,
    serie_final: registro.serie_final ?? null,
    serie: registro.serie ?? null,
    marcado: marcacao.marcado,
    data_marcacao: marcacao.data_marcacao,
    usuario_marcacao: marcacao.usuario_marcacao
  };
}

export async function fetchOPs() {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('registro_op')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    console.error('Error fetching OPs:', error);
    throw error;
  }

  return ((data || []) as OPRecord[]).map(normalizarRegistroParaNovoModelo);
}

export async function updateOPMarcadoByOP(
  op: string,
  marcado: boolean,
  user: string = 'Usuário'
) {
  if (!supabase) throw new Error('Supabase not configured');

  const now = new Date().toISOString();

  const updates: Partial<OPRecord> = marcado
    ? {
        marcado: true,
        data_marcacao: now,
        usuario_marcacao: user,
        status: 'recolhido',
        data_recolhimento: now,
        usuario_recolhimento: user
      }
    : {
        marcado: false,
        data_marcacao: null,
        usuario_marcacao: null,
        status: 'pendente_impressao',
        data_impressao: null,
        usuario_impressao: null,
        data_recolhimento: null,
        usuario_recolhimento: null
      };

  const { data, error } = await supabase
    .from('registro_op')
    .update(updates)
    .eq('op', op)
    .select();

  if (error) {
    console.error(`Error updating OP ${op}:`, error);
    throw error;
  }

  return data;
}

// Mantidas por compatibilidade. O novo layout usa updateOPMarcadoByOP.
export async function updateOPStatus(
  id: number,
  status: OPStatus,
  user: string = 'Usuário'
) {
  if (!supabase) throw new Error('Supabase not configured');

  const now = new Date().toISOString();
  const updates: Partial<OPRecord> = { status };

  if (status === 'pendente_impressao') {
    updates.marcado = false;
    updates.data_marcacao = null;
    updates.usuario_marcacao = null;
    updates.data_impressao = null;
    updates.usuario_impressao = null;
    updates.data_recolhimento = null;
    updates.usuario_recolhimento = null;
  }

  if (status === 'impresso') {
    updates.marcado = true;
    updates.data_marcacao = now;
    updates.usuario_marcacao = user;
    updates.data_impressao = now;
    updates.usuario_impressao = user;
    updates.data_recolhimento = null;
    updates.usuario_recolhimento = null;
  }

  if (status === 'recolhido') {
    updates.marcado = true;
    updates.data_marcacao = now;
    updates.usuario_marcacao = user;
    updates.data_recolhimento = now;
    updates.usuario_recolhimento = user;
  }

  const { data, error } = await supabase
    .from('registro_op')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) {
    console.error(`Error updating OP ${id}:`, error);
    throw error;
  }

  return data;
}

export async function updateOPStatusByOP(
  op: string,
  status: Extract<OPStatus, 'pendente_impressao' | 'impresso'>,
  user: string = 'Usuário'
) {
  return updateOPMarcadoByOP(op, status === 'impresso', user);
}

function gerarChaveSync(op: Partial<OPRecord>): string {
  return [
    String(op.op || '').trim(),
    String(op.data_programada || '').trim(),
    Number(op.qtde || 0),
    String(op.setor || '').trim()
  ].join('|');
}

export async function syncOPsWithExcel(opsFromExcel: Partial<OPRecord>[]) {
  if (!supabase) throw new Error('Supabase not configured');

  const excelByKey = new Map<string, Partial<OPRecord>>();
  for (const op of opsFromExcel) {
    const chave = gerarChaveSync(op);
    if (!excelByKey.has(chave)) {
      excelByKey.set(chave, op);
    }
  }

  const opsNormalizadas = Array.from(excelByKey.values());
  const excelKeys = new Set(opsNormalizadas.map(gerarChaveSync));

  const { data: currentRecords, error: fetchError } = await supabase
    .from('registro_op')
    .select('*');

  if (fetchError) {
    console.error('Error fetching current OPs before sync:', fetchError);
    throw fetchError;
  }

  const registrosAtuais = (currentRecords || []) as OPRecord[];
  const currentByKey = new Map<string, OPRecord>();

  for (const record of registrosAtuais) {
    currentByKey.set(gerarChaveSync(record), record);
  }

  const idsToDelete = registrosAtuais
    .filter(record => !excelKeys.has(gerarChaveSync(record)))
    .map(record => record.id);

  if (idsToDelete.length > 0) {
    const { error: deleteError } = await supabase
      .from('registro_op')
      .delete()
      .in('id', idsToDelete);

    if (deleteError) {
      console.error('Error deleting OPs not present in Excel:', deleteError);
      throw deleteError;
    }
  }

  const recordsToUpsert = opsNormalizadas.map(opExcel => {
    const registroAtual = currentByKey.get(gerarChaveSync(opExcel));
    const marcacao = obterMarcacaoPreservada(registroAtual);

    return {
      ...opExcel,
      status: registroAtual?.status || (marcacao.marcado ? 'recolhido' : 'pendente_impressao'),
      marcado: marcacao.marcado,
      data_marcacao: marcacao.data_marcacao,
      usuario_marcacao: marcacao.usuario_marcacao,
      data_impressao: registroAtual?.data_impressao || null,
      usuario_impressao: registroAtual?.usuario_impressao || null,
      data_recolhimento: registroAtual?.data_recolhimento || null,
      usuario_recolhimento: registroAtual?.usuario_recolhimento || null
    };
  });

  const insertedCount = recordsToUpsert.filter(record => !currentByKey.has(gerarChaveSync(record))).length;
  const updatedCount = recordsToUpsert.length - insertedCount;

  const { data: upsertedRecords, error: upsertError } = await supabase
    .from('registro_op')
    .upsert(recordsToUpsert, {
      onConflict: 'op,qtde,data_programada,setor',
      ignoreDuplicates: false
    })
    .select();

  if (upsertError) {
    console.error('Error syncing OPs:', upsertError);
    throw upsertError;
  }

  return {
    inserted: upsertedRecords || [],
    insertedCount,
    updatedCount,
    deletedCount: idsToDelete.length,
    excelCount: opsFromExcel.length,
    validUniqueCount: opsNormalizadas.length
  };
}
