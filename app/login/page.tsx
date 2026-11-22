'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import AuthShell from '@/components/AuthShell';

function idMsg(m: string) {
  if (m === 'Invalid login credentials') return 'Email atau kata sandi salah.';
  if (/failed to fetch|network/i.test(m)) return 'Tidak dapat terhubung ke server autentikasi. Periksa koneksi atau konfigurasi Supabase.';
  if (/email not confirmed/i.test(m)) return 'Email belum dikonfirmasi. Periksa kotak masuk Anda.';
  if (/rate limit/i.test(m)) return 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.';
  return m;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; m: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setMsg({ t: 'err', m: idMsg(error.message) }); return; }
    router.replace('/'); router.refresh();
  }
  async function onReset() {
    if (!email) { setMsg({ t: 'err', m: 'Isi email terlebih dahulu.' }); return; }
    const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/akun/password` });
    setMsg(error ? { t: 'err', m: idMsg(error.message) } : { t: 'ok', m: 'Tautan atur ulang kata sandi telah dikirim ke email Anda.' });
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} noValidate>
        <h2>Selamat Datang</h2>
        <p className="ls">Gunakan email dan kata sandi yang diberikan administrator. Hubungi administrator bila lupa kata sandi.</p>
        {msg && <div className={`lm ${msg.t}`}>{msg.m}</div>}
        <label className="lf">Email<input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="lf">Kata sandi
          <div className="pw"><input type={show ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow(!show)}>{show ? 'Sembunyikan' : 'Lihat'}</button></div>
        </label>
        <div className="lr"><span /><button type="button" onClick={onReset}>Lupa kata sandi?</button></div>
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
      </form>
    </AuthShell>
  );
}
