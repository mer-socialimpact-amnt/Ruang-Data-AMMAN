import { cookies } from 'next/headers';
import { pool } from './db';
import { SESSION_COOKIE, verifySession } from './session';

export type Role = 'admin' | 'editor' | 'viewer' | 'mitra';
export type AppUser = { id: string; email: string; nama: string | null; role: Role | null; mitra_id: string | null; mitra_nama: string | null; wajib?: boolean; versi?: number };

export const devBypass = () => process.env.RD_DEV_BYPASS_AUTH === '1' && process.env.NODE_ENV !== 'production';

/** Pengguna yang sedang login beserta perannya; null bila belum login / sesi tidak berlaku. */
export async function getAppUser(): Promise<AppUser | null> {
  if (devBypass()) {
    const role = (process.env.RD_DEV_ROLE as Role) || 'admin';
    return { id: '00000000-0000-0000-0000-000000000000', email: 'dev@localhost', nama: 'Developer (lokal)', role, mitra_id: process.env.RD_DEV_MITRA || null, mitra_nama: null };
  }
  const claims = await verifySession(cookies().get(SESSION_COOKIE)?.value);
  if (!claims || !/^[0-9a-f-]{36}$/i.test(claims.sub)) return null;
  const r = await pool().query(
    `SELECT u.id, u.email, u.nama, u.role, u.mitra_id, u.aktif, u.wajib_ganti_sandi, u.sesi_versi, m.nama_mitra
       FROM si.app_user u LEFT JOIN si.mitra m ON m.mitra_id = u.mitra_id WHERE u.id = $1`, [claims.sub]);
  const row = r.rows[0];
  if (!row || !row.aktif || !row.role || row.sesi_versi !== claims.v) return null;
  return { id: row.id, email: row.email, nama: row.nama, role: row.role, mitra_id: row.mitra_id, mitra_nama: row.nama_mitra, wajib: !!row.wajib_ganti_sandi, versi: row.sesi_versi };
}

export async function audit(user: { id: string; email: string } | null, tabel: string, aksi: string, key: string, data: unknown = null) {
  await pool().query('INSERT INTO si.audit_log (user_id, email, tabel, aksi, record_key, data) VALUES ($1, $2, $3, $4, $5, $6)',
    [user && /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null, user?.email ?? null, tabel, aksi, key, data === null ? null : JSON.stringify(data)]);
}
