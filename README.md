# Ruang Data
**Satu Ruang, Beragam Data** · master data peserta Social Impact AMMAN (pilar HCD, EE, ST dan 8 program area PPM).

Versi Next.js 14 + Supabase dari aplikasi Ruang Data (HTML). Tampilan, menu, formulir, laporan infografis, saran isian, dan hapus/urungkan **identik** dengan versi HTML. Bedanya hanya di penyimpanan (database Supabase, bukan browser) dan login berbasis peran.

## Arsitektur
| Lapisan | Isi |
|---|---|
| UI | `public/ruangdata-engine.js` (engine UI versi HTML) dimuat oleh `components/RuangDataApp.tsx`; gaya di `app/globals.css`, font Inter lokal |
| API | `app/api/data` (baca semua tabel sesuai peran) · `app/api/mutate` (simpan/hapus dalam satu transaksi + audit log) |
| Database | Supabase Postgres, skema `si` (`supabase/schema.sql`): PK/FK/CHECK, view analitik, RLS aktif, tidak diekspos ke Data API |
| Auth | Supabase Auth (email & kata sandi) + tabel `si.app_user` untuk peran |
| Koneksi | `DATABASE_URL` = Transaction pooler **6543** (runtime/Vercel) · `DIRECT_URL` = **5432** (skema & seed) |

### Peran (RBAC)
| Peran | Hak |
|---|---|
| `admin` | Semua, termasuk referensi (program, wilayah & ring, kode, mitra, asumsi) |
| `editor` | Tambah/ubah/hapus peserta, keikutsertaan, tracer, usaha, omzet, lembaga, infrastruktur; tandai isu |
| `viewer` | Hanya melihat, laporan infografis, ekspor |
| `mitra` | Hanya melihat peserta & data dari program yang dijalankan mitranya (wajib `mitra_id`) |

Pembatasan diterapkan di server (`/api/*`); tombol yang tidak diizinkan juga disembunyikan di UI.

## 1. Siapkan Supabase
1. Buat project di <https://supabase.com> (region **Southeast Asia (Singapore)**).
2. **Authentication → Providers → Email**: aktifkan; matikan *Allow new users to sign up* (pengguna diundang admin).
3. **Authentication → URL Configuration**: isi *Site URL* dengan URL Vercel Anda, tambahkan `https://<domain-anda>/auth/callback` ke *Redirect URLs*.
4. Salin kredensial: **Project Settings → API** (URL & anon key) dan **Project Settings → Database → Connection string** (Transaction pooler 6543 & Session/Direct 5432).

## 2. Jalankan lokal
```bash
cp .env.example .env.local     # isi semua variabel
npm install
npm run db:apply               # membuat skema si (sekali)
# ekstrak paket seed PRIVAT ke data-private/csv/  (folder ini di-.gitignore)
npm run db:seed
npm run dev                    # http://localhost:3000
```
Login pertama: undang diri Anda di **Authentication → Users → Invite user**, atau buat user dengan kata sandi. Email yang tercantum di `ADMIN_EMAILS` otomatis menjadi admin saat login pertama. Alternatif: jalankan `supabase/promote-admin.sql` di SQL Editor.

Menambah pengguna lain: undang lewat Supabase Auth, lalu beri peran:
```sql
INSERT INTO si.app_user (id, email, nama, role, mitra_id)
SELECT id, email, 'Nama Lengkap', 'editor', NULL FROM auth.users WHERE email = 'staf@ammanmineral.com';
-- peran mitra:  role = 'mitra', mitra_id = 'MTR-005'
```

## 3. Publikasi ke GitHub
```bash
git init && git add . && git commit -m "Ruang Data: Next.js + Supabase"
git branch -M main
git remote add origin git@github.com:<akun>/ruang-data.git
git push -u origin main
```
`.gitignore` sudah mengecualikan `.env*`, `data-private/`, dan semua `*.csv` agar data pribadi peserta tidak ikut ter-commit. **Gunakan repository private.**

## 4. Deploy ke Vercel
1. **Add New → Project → Import** repository GitHub tadi (framework terdeteksi Next.js).
2. Isi **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (pooler 6543), `ADMIN_EMAILS`. `DIRECT_URL` tidak diperlukan di Vercel.
3. Deploy. Region fungsi diatur ke `sin1` (Singapura) di `vercel.json`, dekat dengan Supabase Singapura.
4. Perbarui *Site URL* dan *Redirect URLs* di Supabase sesuai domain Vercel.

## Catatan keamanan & data
- Jangan pernah mengatur `RD_DEV_BYPASS_AUTH` di Vercel (hanya berlaku saat `NODE_ENV` bukan production).
- Skema `si` tidak diekspos ke Data API; anon key tidak bisa membaca data peserta.
- Setiap perubahan tercatat di `si.audit_log` (siapa, kapan, tabel, aksi, data).
- Data pribadi (NIK, No. KK) tunduk pada UU 27/2022 PDP: batasi peran, gunakan repo private, simpan paket seed di lokasi terbatas, dan hapus setelah seed selesai.

## Struktur
```
app/            halaman (/, /login, /akun/password), API (/api/data, /api/mutate), auth (/auth/*)
components/     RuangDataApp (memuat engine), AuthShell, NoAccess
lib/            koneksi pg, auth & peran, schema.json (kamus data, sumber tunggal)
public/         ruangdata-engine.js, logo, font Inter
scripts/        apply-schema, seed, check-db
supabase/       schema.sql, promote-admin.sql
```
