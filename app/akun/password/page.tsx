'use client';
import { useEffect, useState } from 'react';
import AuthShell from '@/components/AuthShell';

export default function SetPasswordPage() {
  const [lama, setLama] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [wajib, setWajib] = useState(false);
  useEffect(() => { setWajib(new URLSearchParams(location.search).get('wajib') === '1'); }, []);
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (pw.length < 8) return setMsg('Kata sandi baru minimal 8 karakter.');
    if (pw !== pw2) return setMsg('Konfirmasi kata sandi tidak sama.');
    setBusy(true);
    try {
      const r = await fetch('/api/akun/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lama, baru: pw }) });
      const js = await r.json().catch(() => ({}));
      if (r.status === 401) { location.replace('/login'); return; }
      if (!r.ok) { setMsg(js.error || `Gagal (HTTP ${r.status}).`); setBusy(false); return; }
      location.replace('/');
    } catch { setMsg('Tidak dapat terhubung ke server.'); setBusy(false); }
  }
  return (
    <AuthShell>
      <form onSubmit={onSubmit} noValidate>
        <h2>{wajib ? 'Ganti kata sandi awal' : 'Ganti kata sandi'}</h2>
        <p className="ls">{wajib ? 'Demi keamanan, buat kata sandi baru sebelum melanjutkan ke Ruang Data.' : 'Masukkan kata sandi saat ini, lalu buat kata sandi baru.'}</p>
        {msg && <div className="lm err">{msg}</div>}
        <label className="lf">{wajib ? 'Kata sandi awal (dari administrator)' : 'Kata sandi saat ini'}<input type="password" required autoComplete="current-password" value={lama} onChange={(e) => setLama(e.target.value)} /></label>
        <label className="lf">Kata sandi baru (min. 8 karakter)<input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
        <label className="lf">Ulangi kata sandi baru<input type="password" required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan kata sandi'}</button>
        {!wajib && <div className="lr" style={{ marginTop: 12 }}><a href="/" style={{ color: 'var(--ink-2)', fontSize: 12 }}>← Kembali ke Ruang Data</a><span /></div>}
      </form>
    </AuthShell>
  );
}
