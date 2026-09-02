import type { VercelRequest, VercelResponse } from './_lib/vercel-types.js';
import { getSessionEmail } from './_lib/auth.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const email = getSessionEmail(req);
    return res.status(200).json(email ? { user: { email } } : { user: null });
  } catch (error) {
    console.error('Erro ao validar sessão:', error);
    const message = error instanceof Error ? error.message : 'Erro ao validar sessão.';
    return res.status(500).json({ error: message });
  }
}
