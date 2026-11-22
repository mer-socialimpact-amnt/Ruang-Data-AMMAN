'use client';
import { useState } from 'react';
import AuthShell from '@/components/AuthShell';

export default function DiagPage() {
  const [kunci, setKunci] = useState(''); const [email, setEmail] = useState('admin@ruangdata.id'); const [pw, setPw] = useState('');
  const [hasil, setHasil] = useState<string>(''); const [busy, setBusy] = useState(false);
  async function run(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const r = await fetch('/api/diag', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kunci, email, password: pw }) });
    setHasil(JSON.stringify(await r.json().catch(() => ({ error: 'HTTP ' + r.status })), null, 2)); setBusy(false);
  }
  return (
    <AuthShell>
      <form onSubmit={run}>
        <h2>Diagnosa koneksi</h2>
        <p className="ls">Khusus pengelola. Masukkan nilai AUTH_SECRET dari Vercel. Hasil tidak menampilkan kata sandi.</p>
        <label className="lf">AUTH_SECRET<input type="password" value={kunci} onChange={(e) => setKunci(e.target.value)} autoComplete="off" /></label>
        <label className="lf">Email yang diuji<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="lf">Kata sandi yang diuji<input type="text" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" /></label>
        <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Memeriksa…' : 'Periksa'}</button>
        {hasil && <pre style={{ marginTop: 14, maxHeight: 340, overflow: 'auto', fontSize: 11, background: '#F6F4F2', padding: 10, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{hasil}</pre>}
      </form>
    </AuthShell>
  );
}
