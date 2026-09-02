import type { VercelRequest, VercelResponse } from './_lib/vercel-types.js';
import { getSessionEmail } from './_lib/auth.js';
import { getDb } from './_lib/db.js';
import { normalizeDbRecord } from './_lib/ops.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const email = getSessionEmail(req);
    if (!email) return res.status(401).json({ error: 'Sessão expirada ou inválida.' });

    const sql = getDb();
    const rows = await sql`SELECT * FROM registro_op ORDER BY id DESC`;
    return res.status(200).json(rows.map((row) => normalizeDbRecord(row)));
  } catch (error) {
    console.error('Erro ao buscar OPs:', error);
    const message = error instanceof Error ? error.message : 'Erro ao carregar OPs.';
    return res.status(500).json({ error: message });
  }
}
