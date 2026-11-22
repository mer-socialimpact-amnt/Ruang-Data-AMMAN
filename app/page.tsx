import { redirect } from 'next/navigation';
import { getAppUser, type AppUser } from '@/lib/auth';
import RuangDataApp from '@/components/RuangDataApp';
import AuthShell from '@/components/AuthShell';
import { diagnosa } from '@/lib/diagnosa';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let user: AppUser | null;
  try {
    user = await getAppUser();
  } catch (e) {
    console.error('[Ruang Data] gagal getAppUser:', e);
    const d = diagnosa(e);
    return (
      <AuthShell>
        <form action="/auth/signout" method="post">
          <h2>Koneksi database bermasalah</h2>
          <p className="ls">Aplikasi belum bisa membaca database.</p>
          <div className="lm err"><b>{d.judul}</b><br />{d.saran}<br /><small>Kode: {d.kode}</small></div>
          <button className="btn pri" type="submit" style={{ marginTop: 14 }}>Kembali ke halaman masuk</button>
        </form>
      </AuthShell>
    );
  }
  if (!user) redirect('/auth/signout');
  if (user.wajib) redirect('/akun/password?wajib=1');
  return <RuangDataApp user={user} />;
}
