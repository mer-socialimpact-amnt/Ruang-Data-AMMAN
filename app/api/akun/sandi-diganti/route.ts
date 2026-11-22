import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAppUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Dipanggil setelah pengguna mengganti kata sandi; menghapus tanda wajib ganti sandi. */
export async function POST() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  await pool().query('UPDATE si.app_user SET wajib_ganti_sandi = false WHERE id = $1', [user.id]);
  return NextResponse.json({ ok: true });
}
