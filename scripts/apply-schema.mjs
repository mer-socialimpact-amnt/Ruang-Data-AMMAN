// Menerapkan db/schema.sql ke database (aman dijalankan ulang). --force = hapus skema si beserta SEMUA data lalu buat ulang.
import fs from 'node:fs';
import pg from 'pg';
import { directUrl, pgConfig } from './_env.mjs';

const client = new pg.Client(pgConfig(directUrl()));
await client.connect();
if (process.argv.includes('--force')) { console.log('Menghapus skema si (--force)…'); await client.query('DROP SCHEMA IF EXISTS si CASCADE'); }
await client.query(fs.readFileSync('db/schema.sql', 'utf8'));
console.log('✓ Skema si siap.');
await client.end();
