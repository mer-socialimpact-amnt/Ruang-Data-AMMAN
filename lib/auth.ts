import { pool } from './db';
import { supabaseServer } from './supabase/server';

export type Role = 'admin' | 'editor' | 'viewer' | 'mitra';
export type AppUser = { id: string; email: string; nama: string | null; role: Role | null; mitra_id: string | null; mitra_nama: string | null };

export const devBypass = () => process.env.RD_DEV_BYPASS_AUTH === '1' && process.env.NODE_ENV !== 'production';

/** Pengguna yang sedang login beserta perannya; null bila belum login. role=null bila belum diberi akses. */
export async function getAppUser(): Promise<AppUser | null> {
  if (devBypass()) {
    const role = (process.env.RD_DEV_ROLE as Role) || 'admin';
    return { id: '00000000-0000-0000-0000-000000000000', email: 'dev@localhost', nama: 'Developer (lokal)', role, mitra_id: process.env.RD_DEV_MITRA || null, mitra_nama: null };
  }
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user || !user.email) return null;
  const db = pool();
  let r = await db.query(
    'SELECT u.id, u.email, u.nama, u.role, u.mitra_id, u.aktif, m.nama_mitra FROM si.app_user u LEFT JOIN si.mitra m ON m.mitra_id = u.mitra_id WHERE u.id = $1',
    [user.id]);
  if (!r.rowCount) {
    const admins = (process.env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (admins.includes(user.email.toLowerCase())) {
      await db.query("INSERT INTO si.app_user (id, email, nama, role) VALUES ($1, $2, $3, 'admin') ON CONFLICT (id) DO NOTHING",
        [user.id, user.email, (user.user_metadata as { name?: string })?.name || user.email]);
      r = await db.query('SELECT u.id, u.email, u.nama, u.role, u.mitra_id, u.aktif, NULL AS nama_mitra FROM si.app_user u WHERE u.id = $1', [user.id]);
    }
  }
  const row = r.rows[0];
  if (!row || !row.aktif) return { id: user.id, email: user.email, nama: null, role: null, mitra_id: null, mitra_nama: null };
  return { id: row.id, email: row.email, nama: row.nama, role: row.role, mitra_id: row.mitra_id, mitra_nama: row.nama_mitra };
}
