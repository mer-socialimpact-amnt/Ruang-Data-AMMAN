import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAppUser } from '@/lib/auth';
import { SCHEMA, TABLES, pkOf, q } from '@/lib/schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Row = Record<string, unknown>;

export async function GET() {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  if (!user.role) return NextResponse.json({ error: 'Akun belum memiliki akses' }, { status: 403 });
  const db = pool();
  const all: Record<string, Row[]> = {};
  for (const t of TABLES) {
    const cols = SCHEMA[t].cols.map((c) => q(c.name)).join(', ');
    const order = pkOf(t).map(q).join(', ');
    const r = await db.query(`SELECT ${cols} FROM si.${q(t)} ORDER BY ${order}`);
    all[t] = r.rows;
  }
  if (user.role === 'mitra') restrictToMitra(all, user.mitra_id);
  const data: Record<string, { cols: string[]; rows: unknown[][] }> = {};
  for (const t of TABLES) {
    const cols = SCHEMA[t].cols.map((c) => c.name);
    data[t] = { cols, rows: all[t].map((r) => cols.map((c) => (r[c] === undefined ? null : r[c]))) };
  }
  const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
  return NextResponse.json({ data, build: { tanggal } }, { headers: { 'Cache-Control': 'no-store' } });
}

/** Peran mitra hanya melihat peserta & data turunan dari keikutsertaan yang dijalankannya. */
function restrictToMitra(all: Record<string, Row[]>, mitraId: string | null) {
  const enr = all.enrollment.filter((e) => e.mitra_id === mitraId);
  const enrIds = new Set(enr.map((e) => e.enrollment_id));
  const pIds = new Set(enr.map((e) => e.peserta_id));
  all.enrollment = enr;
  all.peserta = all.peserta.filter((p) => pIds.has(p.peserta_id));
  const rtIds = new Set(all.peserta.map((p) => p.rumah_tangga_id));
  all.rumah_tangga = all.rumah_tangga.filter((r) => rtIds.has(r.rumah_tangga_id));
  for (const t of ['baseline_peserta', 'tracer_ketenagakerjaan', 'sertifikasi', 'pengukuran_kesehatan', 'kontribusi_lingkungan', 'peserta_usaha'])
    all[t] = all[t].filter((r) => enrIds.has(r.enrollment_id));
  const uIds = new Set(all.peserta_usaha.map((r) => r.usaha_id));
  all.usaha = all.usaha.filter((u) => uIds.has(u.usaha_id));
  for (const t of ['usaha_legalitas', 'usaha_pemantauan', 'usaha_omzet_bulanan']) all[t] = all[t].filter((r) => uIds.has(r.usaha_id));
  const keep = new Set<unknown>([...pIds, ...enrIds, ...uIds]);
  all.log_isu_data = all.log_isu_data.filter((i) => keep.has(i.record_id));
  all.mitra_kontak = all.mitra_kontak.filter((k) => k.mitra_id === mitraId);
  all.lembaga_komunitas = []; all.infrastruktur = []; all.capaian_agregat = [];
  all.epp_kegiatan = []; all.donasi = []; all.internship = [];
}
