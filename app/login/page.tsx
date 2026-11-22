'use client';
import { useState } from 'react';
import AuthShell from '@/components/AuthShell';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ t: 'err' | 'ok' | 'info'; m: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const js = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ t: 'err', m: js.error || `Gagal masuk (HTTP ${r.status}).` }); setBusy(false); return; }
      location.replace(js.wajib ? '/akun/password?wajib=1' : '/');
    } catch {
      setMsg({ t: 'err', m: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' }); setBusy(false);
    }
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
        <div className="lr"><span /><button type="button" onClick={() => setMsg({ t: 'info', m: 'Hubungi administrator Ruang Data untuk mengatur ulang kata sandi Anda melalui menu Pengguna.' })}>Lupa kata sandi?</button></div>
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
      </form>
    </AuthShell>
  );
}
