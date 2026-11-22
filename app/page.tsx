import { redirect } from 'next/navigation';
import { getAppUser, type AppUser } from '@/lib/auth';
import RuangDataApp from '@/components/RuangDataApp';
import NoAccess from '@/components/NoAccess';
import AuthShell from '@/components/AuthShell';

export const dynamic = 'force-dynamic';

/** Menerjemahkan galat koneksi database menjadi petunjuk perbaikan (tanpa membocorkan kredensial). */
function diagnosa(e: unknown): { judul: string; saran: string; kode: string } {
  const err = e as { message?: string; code?: string };
  const m = String(err?.message || e); const c = String(err?.code || '');
  if (/DATABASE_URL belum diatur/.test(m)) return { kode: 'ENV', judul: 'DATABASE_URL belum diatur di Vercel', saran: 'Tambahkan DATABASE_URL (Transaction pooler, port 6543) di Vercel → Settings → Environment Variables, lalu Redeploy.' };
  if (c === '28P01' || /password authentication failed/i.test(m)) return { kode: c || 'AUTH', judul: 'Kata sandi database salah', saran: 'Periksa kata sandi di DATABASE_URL. Bila kata sandi mengandung karakter khusus (@ # % / ? :), encode dulu (mis. @ → %40), atau reset Database password di Supabase → Project Settings → Database.' };
  if (/Tenant or user not found/i.test(m)) return { kode: 'TENANT', judul: 'Pengguna pooler tidak dikenali', saran: 'Pada Transaction pooler, user harus berformat postgres.<project-ref>. Salin ulang connection string dari tombol Connect di Supabase.' };
  if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ENETUNREACH|timeout/i.test(m + c)) return { kode: c || 'NET', judul: 'Server database tidak terjangkau', saran: 'Gunakan connection string Transaction pooler (host *.pooler.supabase.com, port 6543). Direct connection (db.<ref>.supabase.co:5432) tidak terjangkau dari Vercel. Pastikan project Supabase tidak sedang paused.' };
  if (c === '42P01' || c === '3F000' || /does not exist/i.test(m)) return { kode: c || 'SCHEMA', judul: 'Tabel/skema belum ada di database ini', saran: 'Jalankan 01_skema.sql s.d. 04_cek_kelengkapan.sql di SQL Editor pada project Supabase yang sama dengan DATABASE_URL. Detail: ' + m.slice(0, 160) };
  return { kode: c || 'ERR', judul: 'Gagal memuat data pengguna', saran: m.slice(0, 220) };
}

export default async function Home() {
  let user: AppUser | null;
  try {
    user = await getAppUser();
  } catch (e) {
    console.error('[Ruang Data] gagal getAppUser:', e);
    const d = diagnosa(e);
    return (
      <AuthShell>
        <form action="/auth/signout" method="get">
          <h2>Koneksi database bermasalah</h2>
          <p className="ls">Login berhasil, tetapi aplikasi belum bisa membaca database.</p>
          <div className="lm err"><b>{d.judul}</b><br />{d.saran}<br /><small>Kode: {d.kode}</small></div>
          <button className="btn pri" type="submit" style={{ marginTop: 14 }}>Keluar</button>
        </form>
      </AuthShell>
    );
  }
  if (!user) redirect('/login');
  if (!user.role) return <NoAccess email={user.email} />;
  if (user.wajib) redirect('/akun/password?wajib=1');
  return <RuangDataApp user={user} />;
}
