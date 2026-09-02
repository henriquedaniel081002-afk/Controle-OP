import type { OPRecord, OPStatus } from '../../src/types.js';

export function statusLegadoEhMarcado(status?: OPStatus | null): boolean {
  return status === 'impresso' || status === 'recolhido';
}

export function registroEstaMarcado(registro?: Partial<OPRecord>): boolean {
  if (!registro) return false;
  return Boolean(registro.marcado) || statusLegadoEhMarcado(registro.status as OPStatus | null);
}

export function gerarChaveOP(registro: Partial<OPRecord>): string {
  return String(registro.op || '').trim();
}

function compararDataProgramada(a?: string | null, b?: string | null): number {
  return String(a || '9999-12-31').localeCompare(String(b || '9999-12-31'));
}

function numeroValido(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

export function consolidarRegistrosPorOP(ops: Partial<OPRecord>[]) {
  const byOP = new Map<string, Partial<OPRecord>>();

  for (const raw of ops) {
    const op = gerarChaveOP(raw);
    if (!op) continue;

    const atual: Partial<OPRecord> = {
      op,
      data_programada: raw.data_programada ? String(raw.data_programada).slice(0, 10) : null,
      codigo_produto: String(raw.codigo_produto || '').trim(),
      potencia: String(raw.potencia || '').trim(),
      linha: String(raw.linha || '').trim(),
      cliente: String(raw.cliente || '').trim(),
      qtde: Number(raw.qtde || 0),
      setor: String(raw.setor || '').trim(),
      chave_importacao: raw.chave_importacao ? String(raw.chave_importacao) : undefined,
      serie_inicial: numeroValido(raw.serie_inicial),
      serie_final: numeroValido(raw.serie_final),
      serie: raw.serie ? String(raw.serie) : null,
    };

    const existente = byOP.get(op);
    if (!existente) {
      byOP.set(op, atual);
      continue;
    }

    const usarAtualComoBase = compararDataProgramada(atual.data_programada, existente.data_programada) < 0;
    const base = usarAtualComoBase ? atual : existente;
    const complemento = usarAtualComoBase ? existente : atual;

    const iniciais = [existente.serie_inicial, atual.serie_inicial]
      .map(numeroValido)
      .filter((valor): valor is number => valor !== null);
    const finais = [existente.serie_final, atual.serie_final]
      .map(numeroValido)
      .filter((valor): valor is number => valor !== null);

    const serieInicial = iniciais.length ? Math.min(...iniciais) : null;
    const serieFinal = finais.length ? Math.max(...finais) : null;

    byOP.set(op, {
      ...complemento,
      ...base,
      op,
      qtde: Number(existente.qtde || 0) + Number(atual.qtde || 0),
      serie_inicial: serieInicial,
      serie_final: serieFinal,
      serie: serieInicial !== null && serieFinal !== null
        ? (serieInicial === serieFinal ? String(serieInicial) : `${serieInicial} - ${serieFinal}`)
        : (base.serie || complemento.serie || null),
    });
  }

  return Array.from(byOP.values());
}

export function normalizeDbRecord(record: Record<string, unknown>): OPRecord {
  const toIso = (value: unknown): string | null => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return String(value);
  };

  return {
    id: Number(record.id),
    op: String(record.op || ''),
    data_programada: record.data_programada instanceof Date
      ? record.data_programada.toISOString().slice(0, 10)
      : record.data_programada ? String(record.data_programada).slice(0, 10) : null,
    codigo_produto: String(record.codigo_produto || ''),
    potencia: String(record.potencia || ''),
    linha: String(record.linha || ''),
    cliente: String(record.cliente || ''),
    qtde: Number(record.qtde || 0),
    setor: String(record.setor || ''),
    status: (record.status || 'pendente_impressao') as OPStatus,
    chave_importacao: record.chave_importacao ? String(record.chave_importacao) : undefined,
    serie_inicial: record.serie_inicial === null || record.serie_inicial === undefined ? null : Number(record.serie_inicial),
    serie_final: record.serie_final === null || record.serie_final === undefined ? null : Number(record.serie_final),
    serie: record.serie ? String(record.serie) : null,
    marcado: Boolean(record.marcado),
    data_marcacao: toIso(record.data_marcacao),
    usuario_marcacao: record.usuario_marcacao ? String(record.usuario_marcacao) : null,
    data_impressao: toIso(record.data_impressao),
    usuario_impressao: record.usuario_impressao ? String(record.usuario_impressao) : null,
    data_recolhimento: toIso(record.data_recolhimento),
    usuario_recolhimento: record.usuario_recolhimento ? String(record.usuario_recolhimento) : null,
  };
}
