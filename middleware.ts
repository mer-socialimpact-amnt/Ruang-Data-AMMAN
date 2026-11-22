import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

const PUBLIC = ['/login', '/api/auth/login', '/auth/signout'];

export async function middleware(req: NextRequest) {
  if (process.env.RD_DEV_BYPASS_AUTH === '1' && process.env.NODE_ENV !== 'production') return NextResponse.next();
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + '/'));
  let ok = false;
  try { ok = !!(await verifySession(req.cookies.get(SESSION_COOKIE)?.value)); } catch { ok = false; }
  if (!ok && !isPublic) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = ''; return NextResponse.redirect(url);
  }
  if (ok && path === '/login') { const url = req.nextUrl.clone(); url.pathname = '/'; url.search = ''; return NextResponse.redirect(url); }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.png|favicon.ico|fonts/|logo-|login-bg.jpg|ruangdata-engine.js).*)'],
};
