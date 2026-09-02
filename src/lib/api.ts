import type { OPRecord } from '../types';

export type AppSession = {
  user: {
    email: string;
  };
};

export type SyncResult = {
  inserted: OPRecord[];
  insertedCount: number;
  updatedCount: number;
  deletedCount: number;
  removedFromExcelCount: number;
  duplicateRemovedCount: number;
  preservedMarkedCount: number;
  excelCount: number;
  validUniqueCount: number;
  opsAdicionadas: string[];
  opsAtualizadas: string[];
  opsRemovidas: string[];
  opsDuplicadasRemovidas: string[];
  opsMarcadasPreservadas: string[];
};

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    credentials: 'same-origin',
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Erro HTTP ${response.status}.`);
  }
  return payload as T;
}

export async function getSession(): Promise<AppSession | null> {
  const result = await apiRequest<{ user: { email: string } | null }>('/api/auth-session');
  return result.user ? { user: result.user } : null;
}

export async function login(email: string, password: string): Promise<AppSession> {
  return apiRequest<AppSession>('/api/auth-login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  await apiRequest<{ ok: boolean }>('/api/auth-logout', { method: 'POST', body: '{}' });
}

export async function fetchOPs(): Promise<OPRecord[]> {
  return apiRequest<OPRecord[]>('/api/ops');
}

export async function updateOPMarcadoByOP(op: string, marcado: boolean): Promise<OPRecord[]> {
  return apiRequest<OPRecord[]>('/api/ops-mark', {
    method: 'POST',
    body: JSON.stringify({ op, marcado }),
  });
}

function compararDataProgramada(a?: string | null, b?: string | null): number {
  return String(a || '9999-12-31').localeCompare(String(b || '9999-12-31'));
}

function consolidarAntesDoEnvio(ops: Partial<OPRecord>[]) {
  const byOP = new Map<string, Partial<OPRecord>>();

  for (const item of ops) {
    const op = String(item.op || '').trim();
    if (!op) continue;
    const existente = byOP.get(op);
    if (!existente) {
      byOP.set(op, { ...item, op });
      continue;
    }

    const usarAtualComoBase = compararDataProgramada(item.data_programada, existente.data_programada) < 0;
    const base = usarAtualComoBase ? item : existente;
    const complemento = usarAtualComoBase ? existente : item;
    const iniciais = [existente.serie_inicial, item.serie_inicial]
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const finais = [existente.serie_final, item.serie_final]
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const serieInicial = iniciais.length ? Math.min(...iniciais) : null;
    const serieFinal = finais.length ? Math.max(...finais) : null;

    byOP.set(op, {
      ...complemento,
      ...base,
      op,
      qtde: Number(existente.qtde || 0) + Number(item.qtde || 0),
      serie_inicial: serieInicial,
      serie_final: serieFinal,
      serie: serieInicial !== null && serieFinal !== null
        ? (serieInicial === serieFinal ? String(serieInicial) : `${serieInicial} - ${serieFinal}`)
        : (base.serie || complemento.serie || null),
    });
  }

  return Array.from(byOP.values());
}

export async function syncOPsWithExcel(ops: Partial<OPRecord>[]): Promise<SyncResult> {
  const consolidated = consolidarAntesDoEnvio(ops);
  return apiRequest<SyncResult>('/api/ops-sync', {
    method: 'POST',
    body: JSON.stringify({ ops: consolidated }),
  });
}
