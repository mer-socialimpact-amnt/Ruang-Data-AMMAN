-- Membuat (atau memulihkan) akun admin. Ganti EMAIL dan KATA_SANDI_SEMENTARA, lalu jalankan di Neon SQL Editor.
-- Bila email sudah ada: kata sandi diganti, akun diaktifkan & dibuka kuncinya, peran menjadi admin.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
INSERT INTO si.app_user (email, nama, role, password_hash, wajib_ganti_sandi)
VALUES (lower('admin@ruangdata.id'), 'Administrator', 'admin', crypt('KATA_SANDI_SEMENTARA', gen_salt('bf', 12)), true)
ON CONFLICT (email) DO UPDATE SET role = 'admin', aktif = true, password_hash = EXCLUDED.password_hash,
  wajib_ganti_sandi = true, gagal_login = 0, kunci_sampai = NULL, sesi_versi = si.app_user.sesi_versi + 1, updated_at = now();
