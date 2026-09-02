import type { VercelRequest, VercelResponse } from './_lib/vercel-types.js';
import { authenticateCredentials, createSessionCookie } from './_lib/auth.js';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const email = authenticateCredentials(req.body?.email, req.body?.password);
    if (!email) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    res.setHeader('Set-Cookie', createSessionCookie(email));
    return res.status(200).json({ user: { email } });
  } catch (error) {
    console.error('Erro no login:', error);
    const message = error instanceof Error ? error.message : 'Erro ao autenticar.';
    return res.status(500).json({ error: message });
  }
}
