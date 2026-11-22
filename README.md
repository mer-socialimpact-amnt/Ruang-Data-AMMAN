# Ruang Data
**Satu Ruang, Beragam Data** · master data peserta Social Impact AMMAN (pilar HCD, EE, ST dan 8 program area PPM).

Versi Next.js 14 + **Neon Postgres** dari aplikasi Ruang Data (HTML). Tampilan, menu, formulir, laporan infografis, saran isian, dan hapus/urungkan **identik** dengan versi HTML. Bedanya: data tersimpan di database bersama, dan login berbasis peran dikelola di aplikasi.

## Arsitektur
| Lapisan | Isi |
|---|---|
| UI | `public/ruangdata-engine.js` (engine UI versi HTML) dimuat oleh `components/RuangDataApp.tsx`; gaya di `app/globals.css`, font Inter lokal |
| API | `app/api/data` (baca sesuai peran) · `app/api/mutate` (simpan/hapus dalam satu transaksi + audit log) · `app/api/users` (kelola pengguna, admin) · `app/api/auth/login` · `app/api/akun/password` |
| Database | Neon Postgres, skema `si` (`db/schema.sql`): PK/FK/CHECK, view analitik, audit log |
| Auth | Login mandiri: tabel `si.app_user` (hash **bcrypt**, cost 12), sesi JWT HS256 di cookie `httpOnly`/`SameSite=Lax`/`Secure` (12 jam) |
| Koneksi | `DATABASE_URL` = connection string Neon **pooled** (runtime/Vercel) · `DIRECT_URL` = tanpa pooler (skrip lokal, opsional) |

### Keamanan login
- Kunci akun 15 menit setelah 5 kali salah kata sandi (dibuka admin lewat **Atur sandi**).
- Pengguna baru / hasil atur ulang **wajib** mengganti kata sandi saat login pertama.
- Ganti kata sandi, ubah peran, nonaktifkan, atau atur ulang ⇒ semua sesi lama pengguna itu langsung tidak berlaku (`sesi_versi`).
- Semua aktivitas akun (login, kunci, ganti sandi, tambah/ubah/hapus pengguna) dicatat di `si.audit_log`.
- Lupa kata sandi: admin mengatur ulang di menu **Pengguna**. Admin satu-satunya lupa sandi: jalankan `db/admin-awal.sql` atau `npm run user:admin`.

### Peran (RBAC)
| Peran | Hak |
|---|---|
| `admin` | Semua, termasuk referensi (program, wilayah & ring, kode, mitra, asumsi) dan menu **Pengguna** |
| `editor` | Tambah/ubah/hapus peserta, keikutsertaan, tracer, usaha, omzet, lembaga, infrastruktur; tandai isu |
| `viewer` | Hanya melihat, laporan infografis, ekspor |
| `mitra` | Hanya melihat peserta & data dari program yang dijalankan mitranya (wajib `mitra_id`) |

Pembatasan diterapkan di server (`/api/*`); tombol yang tidak diizinkan juga disembunyikan di UI.

## 1. Siapkan Neon
1. Buat project di <https://console.neon.tech> dengan region **AWS Asia Pacific (Singapore)** agar dekat dengan Vercel `sin1`.
2. Buka **SQL Editor** dan jalankan paket SQL Neon (PRIVAT, terpisah dari repo) berurutan: `01_skema.sql`, `02_data_bagian_*.sql`, `03_admin_awal.sql`, `04_cek_kelengkapan.sql`.
3. Klik **Connect** → salin connection string dengan **Connection pooling** aktif (host berisi `-pooler`) untuk `DATABASE_URL`.

## 2. Jalankan lokal
```bash
cp .env.example .env.local     # isi DATABASE_URL, DIRECT_URL (opsional), AUTH_SECRET
npm install
npm run db:apply               # membuat/melengkapi skema si (aman diulang)
# opsional, alternatif paket SQL: ekstrak paket seed PRIVAT ke data-private/csv/ lalu
npm run db:seed
npm run user:admin -- admin@ruangdata.id "Administrator"   # mencetak kata sandi sementara
npm run dev                    # http://localhost:3000
```

## 3. Publikasi ke GitHub
`.gitignore` sudah mengecualikan `.env*`, `data-private/`, dan semua `*.csv`. **Gunakan repository private.** Paket SQL Neon (berisi data pribadi & kata sandi awal) **jangan** di-commit.

## 4. Deploy ke Vercel
1. Import repository GitHub (framework terdeteksi Next.js).
2. **Environment Variables**: `DATABASE_URL` (Neon pooled) dan `AUTH_SECRET` (acak ≥ 32 karakter: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`). Hapus variabel lama Supabase (`NEXT_PUBLIC_SUPABASE_*`, `ADMIN_EMAILS`).
3. Deploy. Region fungsi `sin1` (Singapura) di `vercel.json`.
4. Alternatif: integrasi **Vercel → Storage → Neon** mengisi `DATABASE_URL` otomatis.

## Catatan keamanan & data
- Jangan pernah mengatur `RD_DEV_BYPASS_AUTH` di Vercel (hanya berlaku saat `NODE_ENV` bukan production).
- Mengganti `AUTH_SECRET` mengeluarkan semua pengguna (semua sesi tidak berlaku).
- Koneksi database memakai TLS dengan verifikasi sertifikat.
- Data pribadi (NIK, No. KK) tunduk pada UU 27/2022 PDP: batasi peran, gunakan repo private, simpan paket SQL/seed di lokasi terbatas, dan hapus setelah dipakai.

## Struktur
```
app/            halaman (/, /login, /akun/password), API (/api/*), /auth/signout
components/     RuangDataApp (memuat engine), AuthShell
lib/            db (pg), session (JWT), password (bcrypt), auth & peran, schema.json (kamus data)
public/         ruangdata-engine.js, logo, font Inter
scripts/        apply-schema, seed, check-db, create-admin
db/             schema.sql, admin-awal.sql
```
