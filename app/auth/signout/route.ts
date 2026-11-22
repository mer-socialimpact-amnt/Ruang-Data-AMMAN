import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

async function signOut(req: Request) {
  await supabaseServer().auth.signOut();
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}
export const GET = signOut;
export const POST = signOut;
