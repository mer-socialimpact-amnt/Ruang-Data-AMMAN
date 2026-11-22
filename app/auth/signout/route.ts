import { NextResponse } from 'next/server';
import { SESSION_COOKIE, cookieOptions } from '@/lib/session';

function signOut(req: Request) {
  const res = NextResponse.redirect(new URL('/login', req.url), { status: 303 });
  res.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
  return res;
}
export const GET = signOut;
export const POST = signOut;
