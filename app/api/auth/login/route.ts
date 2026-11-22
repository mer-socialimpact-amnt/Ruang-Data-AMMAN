import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pool } from '@/lib/db';
import { checkPassword } from '@/lib/password';
import { SESSION_COOKIE, SESSION_HOURS, signSession, cookieOptions } from '@/lib/session';
import { audit } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAKS_GAGAL = 5, KUNCI_MENIT = 15;
let DUMMY: string | null = null; // hash tiruan agar waktu respons sama untuk email tak terdaftar

export async function POST(req: Request) {
  let body: { email?: unknown; password?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 }); }
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!email || !password) return NextResponse.json({ error: 'Isi email dan kata sandi.' }, { status: 400 });

  const db = pool();
  const r = await db.query('SELECT id, email, password_hash, aktif, gagal_login, kunci_sampai, sesi_versi, wajib_ganti_sandi FROM si.app_user WHERE email = $1', [email]);
  const u = r.rows[0];
  if (u && u.kunci_sampai && new Date(u.kunci_sampai) > new Date()) {
    const menit = Math.ceil((new Date(u.kunci_sampai).getTime() - Date.now()) / 60000);
    return NextResponse.json({ error: `Akun dikunci sementara karena terlalu banyak percobaan. Coba lagi dalam ${menit} menit atau hubungi administrator.` }, { status: 429 });
  }
  if (!DUMMY) DUMMY = await bcrypt.hash('ruang-data-dummy', 12);
  const ok = await checkPassword(password, u ? u.password_hash || DUMMY : DUMMY) && !!u?.password_hash;
  if (!u || !ok) {
    if (u) {
      const n = (u.gagal_login || 0) + 1;
      if (n >= MAKS_GAGAL) {
        await db.query(`UPDATE si.app_user SET gagal_login = 0, kunci_sampai = now() + interval '${KUNCI_MENIT} minutes' WHERE id = $1`, [u.id]);
        await audit({ id: u.id, email: u.email }, 'app_user', 'kunci', u.email);
        return NextResponse.json({ error: `${MAKS_GAGAL} kali gagal. Akun dikunci ${KUNCI_MENIT} menit.` }, { status: 429 });
      }
      await db.query('UPDATE si.app_user SET gagal_login = $2 WHERE id = $1', [u.id, n]);
    }
    return NextResponse.json({ error: 'Email atau kata sandi salah.' }, { status: 401 });
  }
  if (!u.aktif) return NextResponse.json({ error: 'Akun ini dinonaktifkan. Hubungi administrator.' }, { status: 403 });
  await db.query('UPDATE si.app_user SET gagal_login = 0, kunci_sampai = NULL, login_terakhir = now() WHERE id = $1', [u.id]);
  await audit({ id: u.id, email: u.email }, 'app_user', 'login', u.email);
  const res = NextResponse.json({ ok: true, wajib: u.wajib_ganti_sandi });
  res.cookies.set(SESSION_COOKIE, await signSession(u.id, u.sesi_versi), cookieOptions(SESSION_HOURS * 3600));
  return res;
}
