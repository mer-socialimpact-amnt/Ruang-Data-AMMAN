import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { audit, getAppUser, type AppUser } from '@/lib/auth';
import { hashPassword, validateNewPassword } from '@/lib/password';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLES = ['admin', 'editor', 'viewer', 'mitra'];
const COLS = 'id, email, nama, role, mitra_id, aktif, wajib_ganti_sandi, (kunci_sampai IS NOT NULL AND kunci_sampai > now()) AS terkunci, login_terakhir, created_at';
const err = (m: string, s = 400) => NextResponse.json({ error: m }, { status: s });

async function requireAdmin(): Promise<AppUser | NextResponse> {
  const user = await getAppUser();
  if (!user) return err('Belum login', 401);
  if (user.role !== 'admin') return err('Hanya admin yang dapat mengelola pengguna', 403);
  return user;
}

export async function GET() {
  const user = await requireAdmin(); if (user instanceof NextResponse) return user;
  const r = await pool().query(`SELECT ${COLS} FROM si.app_user ORDER BY (role IS NULL) DESC, (role = 'admin') DESC, nama NULLS LAST, email`);
  return NextResponse.json({ users: r.rows }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const me = await requireAdmin(); if (me instanceof NextResponse) return me;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return err('Permintaan tidak valid.'); }
  const db = pool();
  const action = String(b.action || '');
  const id = b.id ? String(b.id) : null;
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return err('ID pengguna tidak valid.');
  const target = id ? (await db.query('SELECT id, email, role, aktif FROM si.app_user WHERE id = $1', [id])).rows[0] : null;
  if (id && !target) return err('Pengguna tidak ditemukan.', 404);
  const disetujui = action === 'update' && target && !target.role;
  const adminAktifLain = async () => Number((await db.query("SELECT count(*) FROM si.app_user WHERE role = 'admin' AND aktif AND id <> $1", [id])).rows[0].count);

  try {
    if (action === 'create' || action === 'update') {
      const nama = String(b.nama || '').trim(), role = String(b.role || '');
      const mitra_id = role === 'mitra' ? (b.mitra_id ? String(b.mitra_id) : null) : null;
      if (!nama) return err('Nama wajib diisi.');
      if (!ROLES.includes(role)) return err('Peran tidak dikenal.');
      if (role === 'mitra' && !mitra_id) return err('Pilih mitra untuk peran Mitra.');
      if (action === 'create') {
        const email = String(b.email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return err('Email tidak valid.');
        const bad = validateNewPassword(b.password); if (bad) return err(bad);
        const r = await db.query(
          'INSERT INTO si.app_user (email, nama, role, mitra_id, password_hash, wajib_ganti_sandi) VALUES ($1, $2, $3, $4, $5, true) RETURNING id',
          [email, nama, role, mitra_id, await hashPassword(String(b.password))]);
        await audit(me, 'app_user', 'ins', email, { nama, role, mitra_id });
        return NextResponse.json({ ok: true, id: r.rows[0].id });
      }
      if (target.role === 'admin' && role !== 'admin' && (await adminAktifLain()) < 1) return err('Minimal harus ada satu admin aktif.');
      await db.query('UPDATE si.app_user SET nama = $2, role = $3, mitra_id = $4, sesi_versi = sesi_versi + CASE WHEN role <> $3 OR mitra_id IS DISTINCT FROM $4 THEN 1 ELSE 0 END, updated_at = now() WHERE id = $1',
        [id, nama, role, mitra_id]);
      await audit(me, 'app_user', disetujui ? 'setujui' : 'up', target.email, { nama, role, mitra_id });
      return NextResponse.json({ ok: true });
    }
    if (action === 'reset') {
      const bad = validateNewPassword(b.password); if (bad) return err(bad);
      await db.query(`UPDATE si.app_user SET password_hash = $2, wajib_ganti_sandi = $3, gagal_login = 0, kunci_sampai = NULL,
          sesi_versi = sesi_versi + 1, updated_at = now() WHERE id = $1`, [id, await hashPassword(String(b.password)), id !== me.id]);
      await audit(me, 'app_user', 'reset_sandi', target.email);
      return NextResponse.json({ ok: true });
    }
    if (action === 'toggle') {
      if (id === me.id) return err('Anda tidak dapat menonaktifkan akun sendiri.');
      if (target.aktif && target.role === 'admin' && (await adminAktifLain()) < 1) return err('Minimal harus ada satu admin aktif.');
      await db.query('UPDATE si.app_user SET aktif = NOT aktif, sesi_versi = sesi_versi + 1, updated_at = now() WHERE id = $1', [id]);
      await audit(me, 'app_user', target.aktif ? 'nonaktif' : 'aktif', target.email);
      return NextResponse.json({ ok: true });
    }
    if (action === 'delete') {
      if (id === me.id) return err('Anda tidak dapat menghapus akun sendiri.');
      if (target.role === 'admin' && (await adminAktifLain()) < 1) return err('Admin terakhir tidak dapat dihapus.');
      await db.query('DELETE FROM si.app_user WHERE id = $1', [id]);
      await audit(me, 'app_user', 'del', target.email);
      return NextResponse.json({ ok: true });
    }
    return err('Aksi tidak dikenal.');
  } catch (e) {
    const x = e as { code?: string; message: string };
    if (x.code === '23505') return err('Email sudah terdaftar.', 409);
    if (x.code === '23503') return err('Mitra tidak ditemukan.');
    return err('Kesalahan database: ' + x.message, 500);
  }
}
