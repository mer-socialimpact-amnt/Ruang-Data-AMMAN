// Sesi login: token JWT (HS256) di cookie httpOnly. Aman dipakai di middleware (Edge) maupun server (Node).
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'rd_sesi';
export const SESSION_HOURS = 12;
export type SessionClaims = { sub: string; v: number };

function key() {
  const s = process.env.AUTH_SECRET || '';
  if (s.length < 32) throw new Error('AUTH_SECRET belum diatur (minimal 32 karakter)');
  return new TextEncoder().encode(s);
}

export async function signSession(userId: string, versi: number) {
  return new SignJWT({ v: versi }).setProtectedHeader({ alg: 'HS256' }).setSubject(userId)
    .setIssuedAt().setExpirationTime(`${SESSION_HOURS}h`).sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'] });
    if (!payload.sub || typeof payload.v !== 'number') return null;
    return { sub: payload.sub, v: payload.v };
  } catch { return null; }
}

export const cookieOptions = (maxAgeSec: number) => ({
  httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: maxAgeSec,
});
