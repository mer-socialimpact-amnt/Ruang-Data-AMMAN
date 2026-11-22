import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { pool } from '@/lib/db';
import { checkPassword } from '@/lib/password';
import { diagnosa } from '@/lib/diagnosa';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Diagnosa koneksi & akun. Hanya bisa dipakai oleh pemegang AUTH_SECRET. Tidak menampilkan kata sandi atau hash. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({})) as { kunci?: string; email?: string; password?: string };
  const secret = process.env.AUTH_SECRET || '';
  const k = Buffer.from(String(b.kunci || '')), s = Buffer.from(secret);
  if (secret.length < 32 || k.length !== s.length || !crypto.timingSafeEqual(k, s))
    return NextResponse.json({ error: 'Kunci diagnosa (AUTH_SECRET) tidak cocok.' }, { status: 403 });

  const out: Record<string, unknown> = {};
  const raw = process.env.DATABASE_URL || '';
  try {
    const u = new URL(raw);
    out.vercel_database_url = { user: u.username, host: u.hostname, endpoint: u.hostname.split('.')[0].replace(/-pooler$/, ''), pooled: u.hostname.includes('-pooler'), database: u.pathname.slice(1), panjang_sandi: decodeURIComponent(u.password).length };
  } catch { out.vercel_database_url = raw ? 'format tidak valid' : 'KOSONG'; }
  out.auth_secret_panjang = secret.length;
  try {
    const db = pool();
    const info = await db.query(`SELECT current_database() AS db, current_user AS role, version() AS versi,
      (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'si') AS tabel_si`);
    out.database = info.rows[0];
    const n = await db.query(`SELECT (SELECT count(*) FROM si.peserta) AS peserta, (SELECT count(*) FROM si.app_user) AS pengguna`).catch((e) => ({ rows: [{ error: e.message }] }));
    out.isi = n.rows[0];
    const us = await db.query(`SELECT email, role, aktif, wajib_ganti_sandi, gagal_login, kunci_sampai, left(password_hash, 4) AS jenis_hash,
      length(password_hash) AS panjang_hash, password_hash FROM si.app_user ORDER BY email`).catch(() => ({ rows: [] as Record<string, unknown>[] }));
    const email = String(b.email || '').trim().toLowerCase();
    out.pengguna = await Promise.all(us.rows.map(async (r) => {
      const { password_hash, ...rest } = r as Record<string, unknown>;
      return { ...rest, uji_sandi: r.email === email && b.password ? await checkPassword(String(b.password), password_hash as string | null).catch((e) => 'ERROR: ' + (e as Error).message) : undefined };
    }));
    out.email_diuji_ditemukan = email ? us.rows.some((r) => r.email === email) : undefined;
  } catch (e) {
    out.error_database = diagnosa(e);
  }
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
}
