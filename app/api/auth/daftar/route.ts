import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { pool } from '@/lib/db';
import { audit } from '@/lib/auth';
import { hashPassword, validateNewPassword } from '@/lib/password';
import { diagnosa } from '@/lib/diagnosa';
import { SESSION_COOKIE, SESSION_HOURS, signSession, cookieOptions } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAKS_MENUNGGU = 50; // batas pendaftaran yang belum disetujui (mencegah spam)
let siap = false;

/** Kode admin = ADMIN_SIGNUP_CODE bila diatur, selain itu AUTH_SECRET. Hanya pengelola deployment yang mengetahuinya. */
function kodeAdminValid(kode: string) {
  const ref = process.env.ADMIN_SIGNUP_CODE || process.env.AUTH_SECRET || '';
  if (ref.length < 12 || !kode) return false;
  const a = crypto.createHash('sha256').update(kode).digest(), b = crypto.createHash('sha256').update(ref).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  try { return await daftar(req); }
  catch (e) {
    console.error('[Ruang Data] daftar gagal:', e);
    const d = diagnosa(e);
    return NextResponse.json({ error: `Server bermasalah: ${d.judul}. ${d.saran} (Kode: ${d.kode})` }, { status: 500 });
  }
}

async function daftar(req: Request) {
  let b: { nama?: unknown; email?: unknown; password?: unknown; kode?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 }); }
  const nama = String(b.nama || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().toLowerCase();
  const kode = String(b.kode || '').trim();
  if (!nama) return NextResponse.json({ error: 'Nama lengkap wajib diisi.' }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 });
  const bad = validateNewPassword(b.password); if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  if (kode && !kodeAdminValid(kode)) return NextResponse.json({ error: 'Kode admin tidak cocok. Kosongkan kolom ini bila Anda bukan pengelola.' }, { status: 403 });
  const admin = !!kode;

  const db = pool();
  if (!siap) { await db.query('ALTER TABLE si.app_user ALTER COLUMN role DROP NOT NULL'); siap = true; } // migrasi otomatis untuk skema lama
  const hash = await hashPassword(String(b.password));
  const ada = (await db.query('SELECT id, role FROM si.app_user WHERE email = $1', [email])).rows[0];

  if (admin) {
    // Pengelola (memegang kode admin): buat akun admin, atau pulihkan akun yang sudah ada menjadi admin dengan kata sandi baru.
    const r = await db.query(`INSERT INTO si.app_user (email, nama, role, password_hash, wajib_ganti_sandi, login_terakhir) VALUES ($1, $2, 'admin', $3, false, now())
      ON CONFLICT (email) DO UPDATE SET nama = EXCLUDED.nama, role = 'admin', aktif = true, password_hash = EXCLUDED.password_hash, wajib_ganti_sandi = false,
        gagal_login = 0, kunci_sampai = NULL, sesi_versi = si.app_user.sesi_versi + 1, login_terakhir = now(), updated_at = now()
      RETURNING id, sesi_versi`, [email, nama, hash]);
    const u = r.rows[0];
    await audit({ id: u.id, email }, 'app_user', ada ? 'pulihkan_admin' : 'daftar_admin', email);
    const res = NextResponse.json({ ok: true, admin: true, pulih: !!ada });
    res.cookies.set(SESSION_COOKIE, await signSession(u.id, u.sesi_versi), cookieOptions(SESSION_HOURS * 3600));
    return res;
  }

  if (ada) return NextResponse.json({ error: ada.role ? 'Email sudah terdaftar. Silakan masuk, atau hubungi administrator bila lupa kata sandi.' : 'Email ini sudah mendaftar dan sedang menunggu persetujuan administrator.' }, { status: 409 });
  const n = Number((await db.query('SELECT count(*) FROM si.app_user WHERE role IS NULL')).rows[0].count);
  if (n >= MAKS_MENUNGGU) return NextResponse.json({ error: 'Pendaftaran sedang ditutup karena terlalu banyak akun menunggu persetujuan. Hubungi administrator.' }, { status: 429 });
  await db.query('INSERT INTO si.app_user (email, nama, role, password_hash, wajib_ganti_sandi) VALUES ($1, $2, NULL, $3, false)', [email, nama, hash]);
  await audit(null, 'app_user', 'daftar', email, { nama });
  return NextResponse.json({ ok: true, admin: false });
}
