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
  return String(op.op || '').trim();
}

function compararDataProgramada(a?: string | null, b?: string | null): number {
  const dataA = String(a || '9999-12-31');
  const dataB = String(b || '9999-12-31');
  return dataA.localeCompare(dataB);
}

function consolidarRegistrosExcelPorOP(opsFromExcel: Partial<OPRecord>[]) {
  const excelByOP = new Map<string, Partial<OPRecord>>();

  for (const opExcel of opsFromExcel) {
    const chaveOP = gerarChaveSync(opExcel);
    if (!chaveOP) continue;

    const existente = excelByOP.get(chaveOP);

    if (!existente) {
      excelByOP.set(chaveOP, { ...opExcel, op: chaveOP });
      continue;
    }

    const usarLinhaAtualComoBase = compararDataProgramada(opExcel.data_programada, existente.data_programada) < 0;
    const base = usarLinhaAtualComoBase ? opExcel : existente;
    const complemento = usarLinhaAtualComoBase ? existente : opExcel;

    const serieInicialValores = [existente.serie_inicial, opExcel.serie_inicial]
      .filter((valor): valor is number => typeof valor === 'number' && Number.isFinite(valor));
    const serieFinalValores = [existente.serie_final, opExcel.serie_final]
      .filter((valor): valor is number => typeof valor === 'number' && Number.isFinite(valor));

    const serieInicial = serieInicialValores.length ? Math.min(...serieInicialValores) : (base.serie_inicial ?? complemento.serie_inicial ?? null);
    const serieFinal = serieFinalValores.length ? Math.max(...serieFinalValores) : (base.serie_final ?? complemento.serie_final ?? null);

    excelByOP.set(chaveOP, {
      ...complemento,
      ...base,
      op: chaveOP,
      qtde: Number(existente.qtde || 0) + Number(opExcel.qtde || 0),
      serie_inicial: serieInicial,
      serie_final: serieFinal,
      serie: serieInicial !== null && serieFinal !== null
        ? (serieInicial === serieFinal ? String(serieInicial) : `${serieInicial} - ${serieFinal}`)
        : (base.serie || complemento.serie || null)
    });
  }

  return excelByOP;
}
export async function syncOPsWithExcel(opsFromExcel: Partial<OPRecord>[]) {
  if (!supabase) throw new Error('Supabase not configured');

  const excelByOP = consolidarRegistrosExcelPorOP(opsFromExcel);
  const opsNormalizadas = Array.from(excelByOP.values());
  const excelOPs = new Set(excelByOP.keys());

  const { data: currentRecords, error: fetchError } = await supabase
    .from('registro_op')
    .select('*');

  if (fetchError) {
    console.error('Error fetching current OPs before sync:', fetchError);
    throw fetchError;
  }

  const registrosAtuais = (currentRecords || []) as OPRecord[];
  const currentByOP = new Map<string, OPRecord[]>();

  for (const record of registrosAtuais) {
    const chaveOP = gerarChaveSync(record);
    if (!chaveOP) continue;

    const registrosDaOP = currentByOP.get(chaveOP) || [];
    registrosDaOP.push(record);
    currentByOP.set(chaveOP, registrosDaOP);
  }

  const recordsToDelete = registrosAtuais
    .filter(record => !excelOPs.has(gerarChaveSync(record)));
  const idsToDelete = recordsToDelete.map(record => record.id);
  const opsRemovidas = recordsToDelete.map(record => gerarChaveSync(record)).filter(Boolean);

  const duplicateIdsToDelete: number[] = [];
  const opsDuplicadasRemovidas: string[] = [];
  for (const registrosDaOP of currentByOP.values()) {
    if (registrosDaOP.length <= 1) continue;

    const [registroPreservado, ...duplicados] = [...registrosDaOP].sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    void registroPreservado;
    duplicateIdsToDelete.push(...duplicados.map(record => record.id));
    opsDuplicadasRemovidas.push(...duplicados.map(record => gerarChaveSync(record)).filter(Boolean));
  }

  const idsParaRemover = Array.from(new Set([...idsToDelete, ...duplicateIdsToDelete]));

  if (idsParaRemover.length > 0) {
    const { error: deleteError } = await supabase
      .from('registro_op')
      .delete()
      .in('id', idsParaRemover);

    if (deleteError) {
      console.error('Error deleting OPs not present in Excel or duplicate OP rows:', deleteError);
      throw deleteError;
    }
  }

  let insertedCount = 0;
  let updatedCount = 0;
  let preservedMarkedCount = 0;
  const syncedRecords: OPRecord[] = [];
  const opsAdicionadas: string[] = [];
  const opsAtualizadas: string[] = [];
  const opsMarcadasPreservadas: string[] = [];

  for (const opExcel of opsNormalizadas) {
    const chaveOP = gerarChaveSync(opExcel);
    const registrosAtuaisDaOP = currentByOP.get(chaveOP) || [];
    const registroAtual = [...registrosAtuaisDaOP].sort((a, b) => Number(a.id || 0) - Number(b.id || 0))[0];
    const marcacao = obterMarcacaoPreservada(registroAtual);

    const payload = {
      ...opExcel,
      op: chaveOP,
      status: registroAtual?.status || (marcacao.marcado ? 'recolhido' : 'pendente_impressao'),
      marcado: marcacao.marcado,
      data_marcacao: marcacao.data_marcacao,
      usuario_marcacao: marcacao.usuario_marcacao,
      data_impressao: registroAtual?.data_impressao || null,
      usuario_impressao: registroAtual?.usuario_impressao || null,
      data_recolhimento: registroAtual?.data_recolhimento || null,
      usuario_recolhimento: registroAtual?.usuario_recolhimento || null
    };

    if (marcacao.marcado) {
      preservedMarkedCount += 1;
      opsMarcadasPreservadas.push(chaveOP);
    }

    if (registroAtual?.id) {
      const { data: updated, error: updateError } = await supabase
        .from('registro_op')
        .update(payload)
        .eq('id', registroAtual.id)
        .select()
        .single();

      if (updateError) {
        console.error(`Error updating OP ${chaveOP}:`, updateError);
        throw updateError;
      }

      updatedCount += 1;
      opsAtualizadas.push(chaveOP);
      if (updated) syncedRecords.push(updated as OPRecord);
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('registro_op')
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      console.error(`Error inserting OP ${chaveOP}:`, insertError);
      throw insertError;
    }

    insertedCount += 1;
    opsAdicionadas.push(chaveOP);
    if (inserted) syncedRecords.push(inserted as OPRecord);
  }

  return {
    inserted: syncedRecords,
    insertedCount,
    updatedCount,
    deletedCount: idsParaRemover.length,
    removedFromExcelCount: idsToDelete.length,
    duplicateRemovedCount: duplicateIdsToDelete.length,
    preservedMarkedCount,
    excelCount: opsFromExcel.length,
    validUniqueCount: opsNormalizadas.length,
    opsAdicionadas,
    opsAtualizadas,
    opsRemovidas: Array.from(new Set(opsRemovidas)),
    opsDuplicadasRemovidas: Array.from(new Set(opsDuplicadasRemovidas)),
    opsMarcadasPreservadas: Array.from(new Set(opsMarcadasPreservadas))
  };
}

