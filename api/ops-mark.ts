import type { VercelRequest, VercelResponse } from './_lib/vercel-types';
import { getSessionEmail } from './_lib/auth';
import { getDb } from './_lib/db';
import { normalizeDbRecord } from './_lib/ops';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const email = getSessionEmail(req);
    if (!email) return res.status(401).json({ error: 'Sessão expirada ou inválida.' });

    const op = String(req.body?.op || '').trim();
    const marcado = Boolean(req.body?.marcado);
    if (!op) return res.status(400).json({ error: 'OP não informada.' });

    const sql = getDb();
    const rows = marcado
      ? await sql`
          UPDATE registro_op
          SET marcado = TRUE,
              data_marcacao = NOW(),
              usuario_marcacao = ${email},
              status = 'recolhido',
              data_recolhimento = NOW(),
              usuario_recolhimento = ${email}
          WHERE op = ${op}
          RETURNING *
        `
      : await sql`
          UPDATE registro_op
          SET marcado = FALSE,
              data_marcacao = NULL,
              usuario_marcacao = NULL,
              status = 'pendente_impressao',
              data_impressao = NULL,
              usuario_impressao = NULL,
              data_recolhimento = NULL,
              usuario_recolhimento = NULL
          WHERE op = ${op}
          RETURNING *
        `;

    if (rows.length === 0) return res.status(404).json({ error: 'OP não encontrada.' });
    return res.status(200).json(rows.map((row) => normalizeDbRecord(row)));
  } catch (error) {
    console.error('Erro ao atualizar marcação:', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar marcação.';
    return res.status(500).json({ error: message });
  }
}
