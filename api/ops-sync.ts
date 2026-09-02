import type { VercelRequest, VercelResponse } from './_lib/vercel-types';
import type { OPRecord } from '../src/types';
import { getSessionEmail } from './_lib/auth';
import { getDb } from './_lib/db';
import { consolidarRegistrosPorOP, gerarChaveOP, registroEstaMarcado } from './_lib/ops';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const email = getSessionEmail(req);
    if (!email) return res.status(401).json({ error: 'Sessão expirada ou inválida.' });

    const rawOps = Array.isArray(req.body?.ops) ? req.body.ops as Partial<OPRecord>[] : [];
    if (rawOps.length === 0) return res.status(400).json({ error: 'Nenhuma OP válida foi recebida.' });
    if (rawOps.length > 30000) return res.status(413).json({ error: 'Arquivo com quantidade de registros acima do limite permitido.' });

    const ops = consolidarRegistrosPorOP(rawOps)
      .filter((op) => gerarChaveOP(op) && op.data_programada && op.setor);

    if (ops.length === 0) return res.status(400).json({ error: 'Nenhuma OP válida após a consolidação.' });

    const sql = getDb();
    const result = await sql.begin(async (tx) => {
      const currentRows = await tx`SELECT * FROM registro_op`;
      const currentByOP = new Map<string, Record<string, unknown>>();
      for (const row of currentRows) currentByOP.set(String(row.op || '').trim(), row);

      const incomingOPs = ops.map((op) => gerarChaveOP(op));
      const incomingSet = new Set(incomingOPs);

      const opsAdicionadas = incomingOPs.filter((op) => !currentByOP.has(op));
      const opsAtualizadas = incomingOPs.filter((op) => currentByOP.has(op));
      const opsRemovidas = Array.from(currentByOP.keys()).filter((op) => !incomingSet.has(op));
      const opsMarcadasPreservadas = incomingOPs.filter((op) => {
        const current = currentByOP.get(op);
        return current ? registroEstaMarcado(current as Partial<OPRecord>) : false;
      });

      if (opsRemovidas.length > 0) {
        await tx`DELETE FROM registro_op WHERE op = ANY(${tx.array(opsRemovidas)})`;
      }

      const payloads = ops.map((op) => ({
        op: gerarChaveOP(op),
        data_programada: op.data_programada || null,
        codigo_produto: String(op.codigo_produto || ''),
        potencia: String(op.potencia || ''),
        linha: String(op.linha || ''),
        cliente: String(op.cliente || ''),
        qtde: Number(op.qtde || 0),
        setor: String(op.setor || ''),
        chave_importacao: op.chave_importacao ? String(op.chave_importacao) : null,
        serie_inicial: op.serie_inicial ?? null,
        serie_final: op.serie_final ?? null,
        serie: op.serie || null,
      }));

      await tx`
        INSERT INTO registro_op ${tx(payloads,
          'op',
          'data_programada',
          'codigo_produto',
          'potencia',
          'linha',
          'cliente',
          'qtde',
          'setor',
          'chave_importacao',
          'serie_inicial',
          'serie_final',
          'serie'
        )}
        ON CONFLICT (op) DO UPDATE SET
          data_programada = EXCLUDED.data_programada,
          codigo_produto = EXCLUDED.codigo_produto,
          potencia = EXCLUDED.potencia,
          linha = EXCLUDED.linha,
          cliente = EXCLUDED.cliente,
          qtde = EXCLUDED.qtde,
          setor = EXCLUDED.setor,
          chave_importacao = EXCLUDED.chave_importacao,
          serie_inicial = EXCLUDED.serie_inicial,
          serie_final = EXCLUDED.serie_final,
          serie = EXCLUDED.serie
      `;

      return {
        inserted: [],
        insertedCount: opsAdicionadas.length,
        updatedCount: opsAtualizadas.length,
        deletedCount: opsRemovidas.length,
        removedFromExcelCount: opsRemovidas.length,
        duplicateRemovedCount: 0,
        preservedMarkedCount: opsMarcadasPreservadas.length,
        excelCount: rawOps.length,
        validUniqueCount: ops.length,
        opsAdicionadas,
        opsAtualizadas,
        opsRemovidas,
        opsDuplicadasRemovidas: [],
        opsMarcadasPreservadas,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao sincronizar Excel com Neon:', error);
    const message = error instanceof Error ? error.message : 'Erro ao sincronizar dados.';
    return res.status(500).json({ error: message });
  }
}
