// Membuat/memulihkan akun admin dengan kata sandi sementara acak.
// Pemakaian: npm run user:admin -- email@domain.com "Nama Lengkap"
import crypto from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { directUrl, pgConfig } from './_env.mjs';

const email = (process.argv[2] || '').trim().toLowerCase();
const nama = process.argv[3] || 'Administrator';
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error('Pemakaian: npm run user:admin -- email@domain.com "Nama Lengkap"'); process.exit(1); }
const pw = 'RD-' + crypto.randomBytes(9).toString('base64url');
const c = new pg.Client(pgConfig(directUrl()));
await c.connect();
await c.query(`INSERT INTO si.app_user (email, nama, role, password_hash, wajib_ganti_sandi) VALUES ($1, $2, 'admin', $3, true)
  ON CONFLICT (email) DO UPDATE SET role = 'admin', aktif = true, password_hash = EXCLUDED.password_hash, wajib_ganti_sandi = true,
  gagal_login = 0, kunci_sampai = NULL, sesi_versi = si.app_user.sesi_versi + 1, updated_at = now()`, [email, nama, await bcrypt.hash(pw, 12)]);
await c.end();
console.log(`✓ Admin siap\n  Email      : ${email}\n  Kata sandi : ${pw}\n  (wajib diganti saat login pertama)`);
