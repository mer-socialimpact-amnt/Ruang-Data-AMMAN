/** Menerjemahkan galat koneksi database menjadi petunjuk perbaikan (tanpa membocorkan kredensial). */
export function diagnosa(e: unknown): { judul: string; saran: string; kode: string } {
  const err = e as { message?: string; code?: string };
  const m = String(err?.message || e).replace(/postgres(ql)?:\/\/[^\s]+/g, '[url]'); const c = String(err?.code || '');
  const pesan = ' Pesan: ' + m.slice(0, 200);
  if (/AUTH_SECRET/.test(m)) return { kode: 'ENV', judul: 'AUTH_SECRET belum diatur di Vercel', saran: 'Tambahkan AUTH_SECRET (teks acak minimal 32 karakter) di Vercel → Settings → Environment Variables, lalu Redeploy.' };
  if (/DATABASE_URL belum diatur/.test(m)) return { kode: 'ENV', judul: 'DATABASE_URL belum diatur di Vercel', saran: 'Tambahkan DATABASE_URL (connection string Neon versi pooled) di Vercel → Settings → Environment Variables, lalu Redeploy.' };
  if (c === '28P01' || /password authentication failed/i.test(m)) return { kode: c || 'AUTH', judul: 'Kata sandi database salah', saran: 'Salin ulang connection string dari Neon Console → Connect (centang "Show password"). Bila role password di-reset, perbarui DATABASE_URL lalu Redeploy.' + pesan };
  if (/endpoint.*(disabled|not found|could not be found)|project.*(not found|suspended)|compute time quota/i.test(m)) return { kode: c || 'NEON', judul: 'Endpoint Neon tidak aktif atau tidak ditemukan', saran: 'Pastikan project & branch Neon masih ada, endpoint tidak di-disable, dan kuota compute belum habis. Salin ulang connection string dari Neon Console.' + pesan };
  if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ENETUNREACH|timeout/i.test(m + c)) return { kode: c || 'NET', judul: 'Server database tidak terjangkau', saran: 'Periksa host di DATABASE_URL (format ep-xxxx-pooler.<region>.aws.neon.tech). Compute Neon yang sedang tidur butuh beberapa detik untuk bangun — muat ulang halaman sekali lagi.' + pesan };
  if (/certificate|SSL|TLS/i.test(m)) return { kode: c || 'SSL', judul: 'Koneksi SSL gagal', saran: 'Gunakan connection string asli dari Neon (host *.neon.tech).' + pesan };
  if (c === '3D000') return { kode: c, judul: 'Nama database di DATABASE_URL tidak ditemukan', saran: 'Bagian akhir connection string (mis. /neondb) harus sama dengan database tempat paket SQL dijalankan. Salin ulang dari Neon Console → Connect.' + pesan };
  if (c === '42P01' || c === '3F000' || c === '42703' || /does not exist/i.test(m)) return { kode: c || 'SCHEMA', judul: 'Tabel/skema belum lengkap di database ini', saran: 'Jalankan paket SQL Neon (01_skema.sql s.d. 04_cek_kelengkapan.sql) di SQL Editor pada project & branch yang sama dengan DATABASE_URL.' + pesan };
  return { kode: c || 'ERR', judul: 'Gagal memuat data pengguna', saran: m.slice(0, 240) };
}
