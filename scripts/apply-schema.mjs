// Menerapkan supabase/schema.sql ke database (memakai DIRECT_URL, port 5432).
import fs from 'node:fs';
import pg from 'pg';
import { directUrl, sslFor } from './_env.mjs';

const url = directUrl();
const client = new pg.Client({ connectionString: url, ssl: sslFor(url) });
await client.connect();
const exists = await client.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = 'si'");
if (exists.rowCount && !process.argv.includes('--force')) {
  console.log('Skema "si" sudah ada. Lewati (gunakan --force untuk menghapus dan membuat ulang SEMUA data).');
  await client.end(); process.exit(0);
}
if (exists.rowCount) { console.log('Menghapus skema si (--force)…'); await client.query('DROP SCHEMA si CASCADE'); }
await client.query(fs.readFileSync('supabase/schema.sql', 'utf8'));
console.log('✓ Skema si berhasil dibuat.');
await client.end();
