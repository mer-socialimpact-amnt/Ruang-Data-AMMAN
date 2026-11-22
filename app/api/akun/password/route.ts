import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { audit, getAppUser } from '@/lib/auth';
import { checkPassword, hashPassword, validateNewPassword } from '@/lib/password';
import { SESSION_COOKIE, SESSION_HOURS, signSession, cookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Pengguna mengganti kata sandinya sendiri. Sesi lain milik pengguna ini otomatis tidak berlaku. */
export async function POST(req: Request) {
  const user = await getAppUser();
  if (!user || !user.versi) return NextResponse.json({ error: 'Sesi berakhir. Silakan masuk kembali.' }, { status: 401 });
  let body: { lama?: unknown; baru?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 }); }
  const lama = String(body.lama || ''), baru = body.baru;
  const bad = validateNewPassword(baru); if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const db = pool();
  const { rows } = await db.query('SELECT password_hash FROM si.app_user WHERE id = $1', [user.id]);
  const hash = rows[0]?.password_hash || null;
  if (!(await checkPassword(lama, hash))) return NextResponse.json({ error: 'Kata sandi saat ini salah.' }, { status: 400 });
  if (await checkPassword(String(baru), hash)) return NextResponse.json({ error: 'Gunakan kata sandi yang berbeda dari kata sandi saat ini.' }, { status: 400 });
  const r = await db.query(
    'UPDATE si.app_user SET password_hash = $2, wajib_ganti_sandi = false, sesi_versi = sesi_versi + 1, updated_at = now() WHERE id = $1 RETURNING sesi_versi',
    [user.id, await hashPassword(String(baru))]);
  await audit(user, 'app_user', 'ganti_sandi', user.email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(user.id, r.rows[0].sesi_versi), cookieOptions(SESSION_HOURS * 3600));
  return res;
}
