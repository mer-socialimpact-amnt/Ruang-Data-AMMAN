import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getAppUser } from '@/lib/auth';
import { ADMIN_TABLES, SCHEMA, pkOf, q } from '@/lib/schema';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Op = { t: string; op: 'ins' | 'up' | 'del'; row: Record<string, unknown> };

function coerce(typ: string, v: unknown): unknown {
  if (v === undefined || v === null || v === '') return null;
  if (typ === 'boolean') return v === true || v === 'true';
  if (typ === 'smallint' || typ === 'integer') { const n = Number(v); if (!Number.isInteger(n)) throw new Error('bukan bilangan bulat'); return n; }
  if (typ.startsWith('numeric')) { const n = Number(v); if (!Number.isFinite(n)) throw new Error('bukan angka'); return n; }
  if (typ === 'date') { const s = String(v).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error('format tanggal harus YYYY-MM-DD'); return s; }
  return String(v);
}

export async function POST(req: Request) {
  const user = await getAppUser();
  if (!user) return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  if (user.role !== 'admin' && user.role !== 'editor') return NextResponse.json({ error: 'Peran Anda hanya dapat melihat data' }, { status: 403 });
  let body: { ops?: Op[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Body tidak valid' }, { status: 400 }); }
  const ops = Array.isArray(body.ops) ? body.ops : [];
  if (!ops.length || ops.length > 2000) return NextResponse.json({ error: 'Jumlah operasi tidak valid' }, { status: 400 });

  // validasi & susun SQL
  const stmts: { sql: string; params: unknown[]; t: string; op: string; key: string; row: Record<string, unknown> }[] = [];
  try {
    for (const o of ops) {
      const def = SCHEMA[o.t];
      if (!def || o.t === 'app_user') throw new Error(`Tabel tidak dikenal: ${o.t}`);
      if (!['ins', 'up', 'del'].includes(o.op)) throw new Error('Operasi tidak dikenal');
      if (ADMIN_TABLES.has(o.t) && user.role !== 'admin') throw new Error(`Hanya admin yang dapat mengubah ${def.label}`);
      if (o.t === 'log_isu_data' && o.op !== 'up' && user.role !== 'admin') throw new Error('Isu data hanya dapat diubah statusnya');
      const pk = pkOf(o.t);
      const row = o.row || {};
      const vals: Record<string, unknown> = {};
      for (const c of def.cols) if (Object.prototype.hasOwnProperty.call(row, c.name)) {
        try { vals[c.name] = coerce(c.typ, row[c.name]); } catch (e) { throw new Error(`${def.label} · ${c.label}: ${(e as Error).message}`); }
      }
      for (const k of pk) if (vals[k] === null || vals[k] === undefined) throw new Error(`${def.label}: kunci ${k} kosong`);
      const key = pk.map((k) => String(vals[k])).join('|');
      const tbl = `si.${q(o.t)}`;
      if (o.op === 'del') {
        stmts.push({ sql: `DELETE FROM ${tbl} WHERE ${pk.map((k, i) => `${q(k)} = $${i + 1}`).join(' AND ')}`, params: pk.map((k) => vals[k]), t: o.t, op: 'del', key, row: vals });
      } else {
        const cols = Object.keys(vals);
        const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
        let sql = `INSERT INTO ${tbl} (${cols.map(q).join(', ')}) VALUES (${ph})`;
        if (o.op === 'up') {
          const upd = cols.filter((c) => !pk.includes(c));
          sql += ` ON CONFLICT (${pk.map(q).join(', ')}) ` + (upd.length ? `DO UPDATE SET ${upd.map((c) => `${q(c)} = EXCLUDED.${q(c)}`).join(', ')}` : 'DO NOTHING');
        }
        stmts.push({ sql, params: cols.map((c) => vals[c]), t: o.t, op: o.op, key, row: vals });
      }
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    for (const s of stmts) {
      await client.query(s.sql, s.params);
      await client.query('INSERT INTO si.audit_log (user_id, email, tabel, aksi, record_key, data) VALUES ($1, $2, $3, $4, $5, $6)',
        [/^[0-9a-f-]{36}$/.test(user.id) ? user.id : null, user.email, s.t, s.op, s.key, s.op === 'del' ? null : JSON.stringify(s.row)]);
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, n: stmts.length });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    const err = e as { code?: string; message: string; detail?: string; constraint?: string };
    const msg = err.code === '23505' ? 'Data dengan ID/kunci yang sama sudah ada (mungkin baru dibuat pengguna lain). Muat ulang lalu simpan kembali.'
      : err.code === '23503' ? 'Data masih dirujuk oleh data lain atau rujukan tidak ditemukan.'
      : err.code === '23514' ? `Nilai tidak sesuai aturan (${err.constraint || 'check'}).`
      : err.code === '23502' ? 'Ada kolom wajib yang kosong.'
      : 'Kesalahan database: ' + err.message;
    return NextResponse.json({ error: msg }, { status: err.code === '23505' ? 409 : 400 });
  } finally {
    client.release();
  }
}
