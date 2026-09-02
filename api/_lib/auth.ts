import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from './vercel-types.js';

const COOKIE_NAME = 'controle_op_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  email: string;
  exp: number;
};

type AppUser = {
  email: string;
  password: string;
};

function getSessionSecret(): string {
  const secret = String(process.env.SESSION_SECRET || '').trim();
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET deve ser configurada com pelo menos 32 caracteres.');
  }
  return secret;
}

function normalizeEmail(email: unknown): string {
  return String(email || '').trim().toLowerCase();
}

function getConfiguredUsers(): AppUser[] {
  const users: AppUser[] = [];
  const singleEmail = normalizeEmail(process.env.APP_LOGIN_EMAIL);
  const singlePassword = String(process.env.APP_LOGIN_PASSWORD || '');

  if (singleEmail && singlePassword) {
    users.push({ email: singleEmail, password: singlePassword });
  }

  const rawJson = String(process.env.APP_USERS_JSON || '').trim();
  if (rawJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new Error('APP_USERS_JSON contém JSON inválido.');
    }

    if (!Array.isArray(parsed)) {
      throw new Error('APP_USERS_JSON deve ser uma lista de usuários.');
    }

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const email = normalizeEmail(record.email);
      const password = String(record.password || '');
      if (email && password) users.push({ email, password });
    }
  }

  const unique = new Map<string, AppUser>();
  for (const user of users) unique.set(user.email, user);
  return Array.from(unique.values());
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function authenticateCredentials(email: unknown, password: unknown): string | null {
  const normalizedEmail = normalizeEmail(email);
  const suppliedPassword = String(password || '');
  const users = getConfiguredUsers();

  if (users.length === 0) {
    throw new Error('Nenhum usuário de acesso foi configurado no servidor.');
  }

  const user = users.find((candidate) => candidate.email === normalizedEmail);
  if (!user) return null;
  if (!safeEqual(user.password, suppliedPassword)) return null;
  return user.email;
}

export function createSessionCookie(email: string): string {
  const payload: SessionPayload = {
    email: normalizeEmail(email),
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${encodedPayload}.${sign(encodedPayload)}`;
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    `Max-Age=${SESSION_DURATION_SECONDS}`,
  ].filter(Boolean).join('; ');
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
    'Max-Age=0',
  ].filter(Boolean).join('; ');
}

function getCookie(req: VercelRequest, name: string): string | null {
  const cookieHeader = String(req.headers.cookie || '');
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return rest.join('=') || null;
  }

  return null;
}

export function getSessionEmail(req: VercelRequest): string | null {
  const token = getCookie(req, COOKIE_NAME);
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload);
  if (!safeEqual(expectedSignature, signature)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload?.email || !payload?.exp) return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return normalizeEmail(payload.email);
  } catch {
    return null;
  }
}
