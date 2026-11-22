// Memuat data awal dari CSV (folder data-private/csv — TIDAK di-commit) ke skema si.
// Pemakaian: npm run db:seed -- [folder_csv]
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { directUrl, pgConfig } from './_env.mjs';

const schema = JSON.parse(fs.readFileSync('lib/schema.json', 'utf8'));
const dir = process.argv[2] || 'data-private/csv';
if (!fs.existsSync(dir)) { console.error(`Folder ${dir} tidak ditemukan. Ekstrak paket seed privat ke folder tersebut.`); process.exit(1); }

function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== '');
}
const conv = (typ, v) => {
  if (v === '' || v == null) return null;
  if (typ === 'boolean') return v === 'true' || v === 'TRUE';
  if (typ === 'smallint' || typ === 'integer') return parseInt(v, 10);
  if (typ.startsWith('numeric')) return Number(v);
  return v;
};

const url = directUrl();
const client = new pg.Client(pgConfig(url));
await client.connect();
await client.query('BEGIN');
try {
  for (const [t, def] of Object.entries(schema)) {
    const f = path.join(dir, `${t}.csv`);
    if (!fs.existsSync(f)) { console.log(`- ${t}: (tidak ada file, dilewati)`); continue; }
    const [hdr, ...rows] = parseCSV(fs.readFileSync(f, 'utf8'));
    const cols = hdr.filter((h) => def.cols.some((c) => c.name === h));
    const typ = Object.fromEntries(def.cols.map((c) => [c.name, c.typ]));
    const idx = cols.map((c) => hdr.indexOf(c));
    const pk = def.cols.filter((c) => c.pk).map((c) => `"${c.name}"`).join(', ');
    let n = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500); const params = [];
      const values = chunk.map((r) => '(' + idx.map((j, k) => { params.push(conv(typ[cols[k]], r[j])); return `$${params.length}`; }).join(', ') + ')');
      const res = await client.query(`INSERT INTO si."${t}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES ${values.join(', ')} ON CONFLICT (${pk}) DO NOTHING`, params);
      n += res.rowCount;
    }
    console.log(`✓ ${t}: ${n} baris`);
  }
  await client.query('COMMIT');
  console.log('Seed selesai.');
} catch (e) {
  await client.query('ROLLBACK'); console.error('Seed gagal, semua perubahan dibatalkan:', e.message); process.exitCode = 1;
} finally { await client.end(); }
