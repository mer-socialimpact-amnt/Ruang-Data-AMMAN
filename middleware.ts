import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/auth/callback', '/auth/signout'];

export async function middleware(req: NextRequest) {
  if (process.env.RD_DEV_BYPASS_AUTH === '1' && process.env.NODE_ENV !== 'production') return NextResponse.next();
  let res = NextResponse.next({ request: { headers: req.headers } });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) { return req.cookies.get(name)?.value; },
      set(name: string, value: string, options: CookieOptions) {
        req.cookies.set({ name, value, ...options });
        res = NextResponse.next({ request: { headers: req.headers } });
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        req.cookies.set({ name, value: '', ...options });
        res = NextResponse.next({ request: { headers: req.headers } });
        res.cookies.set({ name, value: '', ...options });
      },
    },
  });
  const { data: { user } } = await sb.auth.getUser();
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path.startsWith(p));
  if (!user && !isPublic) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
    const url = req.nextUrl.clone(); url.pathname = '/login'; url.search = ''; return NextResponse.redirect(url);
  }
  if (user && path === '/login') { const url = req.nextUrl.clone(); url.pathname = '/'; return NextResponse.redirect(url); }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|icon.png|favicon.ico|fonts/|logo-|login-bg.jpg|ruangdata-engine.js).*)'],
};
