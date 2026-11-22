'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import AuthShell from '@/components/AuthShell';

export default function SetPasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [wajib, setWajib] = useState(false);
  useEffect(() => { setWajib(new URLSearchParams(location.search).get('wajib') === '1'); }, []);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setMsg('Kata sandi minimal 8 karakter.');
    if (pw !== pw2) return setMsg('Konfirmasi kata sandi tidak sama.');
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    if (error) return setMsg(/same|different/i.test(error.message) ? 'Gunakan kata sandi yang berbeda dari kata sandi sebelumnya.' : error.message);
    await fetch('/api/akun/sandi-diganti', { method: 'POST' }).catch(() => {});
    router.replace('/'); router.refresh();
  }
  return (
    <AuthShell>
      <form onSubmit={onSubmit}>
        <h2>{wajib ? 'Ganti kata sandi awal' : 'Atur kata sandi'}</h2>
        <p className="ls">{wajib ? 'Demi keamanan, buat kata sandi baru sebelum melanjutkan ke Ruang Data.' : 'Buat kata sandi baru untuk akun Ruang Data Anda.'}</p>
        {msg && <div className="lm err">{msg}</div>}
        <label className="lf">Kata sandi baru<input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label className="lf">Ulangi kata sandi<input type="password" required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <button className="btn pri" type="submit">Simpan kata sandi</button>
      </form>
    </AuthShell>
  );
}
