// Cek cepat koneksi & isi database
import pg from 'pg';
import { directUrl, pgConfig } from './_env.mjs';
const url = directUrl();
const c = new pg.Client(pgConfig(url));
await c.connect();
const r = await c.query(`SELECT 'peserta' t, count(*) n FROM si.peserta UNION ALL SELECT 'enrollment', count(*) FROM si.enrollment
  UNION ALL SELECT 'usaha', count(*) FROM si.usaha UNION ALL SELECT 'app_user', count(*) FROM si.app_user`);
console.table(r.rows);
console.table((await c.query('SELECT * FROM si.v_penerima_manfaat_pilar')).rows);
await c.end();
