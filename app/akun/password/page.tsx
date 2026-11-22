'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import AuthShell from '@/components/AuthShell';

export default function SetPasswordPage() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setMsg('Kata sandi minimal 8 karakter.');
    if (pw !== pw2) return setMsg('Konfirmasi kata sandi tidak sama.');
    const { error } = await supabaseBrowser().auth.updateUser({ password: pw });
    if (error) return setMsg(error.message);
    router.replace('/');
  }
  return (
    <AuthShell>
      <form onSubmit={onSubmit}>
        <h2>Atur kata sandi</h2>
        <p className="ls">Buat kata sandi baru untuk akun Ruang Data Anda.</p>
        {msg && <div className="lm err">{msg}</div>}
        <label className="lf">Kata sandi baru<input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label className="lf">Ulangi kata sandi<input type="password" required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <button className="btn pri" type="submit">Simpan kata sandi</button>
      </form>
    </AuthShell>
  );
}
