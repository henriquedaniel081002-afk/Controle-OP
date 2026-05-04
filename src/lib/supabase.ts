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

  return (data || []) as OPRecord[];
}

export async function updateOPStatus(
  id: number,
  status: OPStatus,
  user: string = 'Usuário'
) {
  if (!supabase) throw new Error('Supabase not configured');

  const now = new Date().toISOString();
  const updates: Partial<OPRecord> = { status };

  if (status === 'pendente_impressao') {
    updates.data_impressao = null;
    updates.usuario_impressao = null;
    updates.data_recolhimento = null;
    updates.usuario_recolhimento = null;
  }

  if (status === 'impresso') {
    updates.data_impressao = now;
    updates.usuario_impressao = user;
    updates.data_recolhimento = null;
    updates.usuario_recolhimento = null;
  }

  if (status === 'recolhido') {
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
  if (!supabase) throw new Error('Supabase not configured');

  const now = new Date().toISOString();
  const updates: Partial<OPRecord> = { status };

  if (status === 'pendente_impressao') {
    updates.data_impressao = null;
    updates.usuario_impressao = null;
    updates.data_recolhimento = null;
    updates.usuario_recolhimento = null;
  }

  if (status === 'impresso') {
    updates.data_impressao = now;
    updates.usuario_impressao = user;
    updates.data_recolhimento = null;
    updates.usuario_recolhimento = null;
  }

  const { data, error } = await supabase
    .from('registro_op')
    .update(updates)
    .eq('op', op)
    .select();

  if (error) {
    console.error(`Error updating duplicated OP ${op}:`, error);
    throw error;
  }

  return data;
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

  const excelKeys = new Set(opsFromExcel.map(gerarChaveSync));

  const { data: currentRecords, error: fetchError } = await supabase
    .from('registro_op')
    .select('id, op, data_programada, qtde, setor');

  if (fetchError) {
    console.error('Error fetching current OPs before sync:', fetchError);
    throw fetchError;
  }

  const idsToDelete = (currentRecords || [])
    .filter(record => !excelKeys.has(gerarChaveSync(record as Partial<OPRecord>)))
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

  const { data: insertedRecords, error: upsertError } = await supabase
    .from('registro_op')
    .upsert(opsFromExcel, {
      onConflict: 'op,qtde,data_programada,setor',
      ignoreDuplicates: true
    })
    .select();

  if (upsertError) {
    console.error('Error syncing OPs:', upsertError);
    throw upsertError;
  }

  return {
    inserted: insertedRecords || [],
    deletedCount: idsToDelete.length,
    excelCount: opsFromExcel.length
  };
}
