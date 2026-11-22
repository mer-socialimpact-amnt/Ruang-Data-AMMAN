'use client';
import { useEffect, useState } from 'react';
import AuthShell from '@/components/AuthShell';

type Msg = { t: 'err' | 'ok' | 'info'; m: string } | null;

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const js = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, js };
}

export default function LoginPage() {
  const [mode, setMode] = useState<'masuk' | 'daftar'>('masuk');
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [kode, setKode] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => { if (new URLSearchParams(location.search).get('daftar') === '1') setMode('daftar'); }, []);
  function ganti(m: 'masuk' | 'daftar') { setMode(m); setMsg(null); setPassword(''); setPassword2(''); }

  async function onMasuk(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      const { ok, status, js } = await post('/api/auth/login', { email, password });
      if (!ok) { setMsg({ t: js.status === 'menunggu' ? 'info' : 'err', m: js.error || `Gagal masuk (HTTP ${status}).` }); setBusy(false); return; }
      location.replace(js.wajib ? '/akun/password?wajib=1' : '/');
    } catch { setMsg({ t: 'err', m: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' }); setBusy(false); }
  }
  async function onDaftar(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (!nama.trim()) return setMsg({ t: 'err', m: 'Nama lengkap wajib diisi.' });
    if (password.length < 8) return setMsg({ t: 'err', m: 'Kata sandi minimal 8 karakter.' });
    if (password !== password2) return setMsg({ t: 'err', m: 'Konfirmasi kata sandi tidak sama.' });
    setBusy(true);
    try {
      const { ok, status, js } = await post('/api/auth/daftar', { nama, email, password, kode: adminMode ? kode : '' });
      if (!ok) { setMsg({ t: 'err', m: js.error || `Pendaftaran gagal (HTTP ${status}).` }); setBusy(false); return; }
      if (js.admin) { location.replace('/'); return; }
      setBusy(false); setMode('masuk'); setPassword(''); setPassword2('');
      setMsg({ t: 'ok', m: 'Pendaftaran berhasil. Akun Anda menunggu persetujuan administrator; Anda dapat masuk setelah administrator menetapkan peran.' });
    } catch { setMsg({ t: 'err', m: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' }); setBusy(false); }
  }

  const pwField = (label: string, val: string, set: (v: string) => void, ac: string) => (
    <label className="lf">{label}
      <div className="pw"><input type={show ? 'text' : 'password'} required autoComplete={ac} value={val} onChange={(e) => set(e.target.value)} />
        <button type="button" onClick={() => setShow(!show)}>{show ? 'Sembunyikan' : 'Lihat'}</button></div>
    </label>
  );

  return (
    <AuthShell>
      <form onSubmit={mode === 'masuk' ? onMasuk : onDaftar} noValidate>
        <div className="ltabs" role="tablist">
          <button type="button" role="tab" aria-selected={mode === 'masuk'} className={mode === 'masuk' ? 'on' : ''} onClick={() => ganti('masuk')}>Masuk</button>
          <button type="button" role="tab" aria-selected={mode === 'daftar'} className={mode === 'daftar' ? 'on' : ''} onClick={() => ganti('daftar')}>Daftar</button>
        </div>
        {mode === 'masuk' ? (<>
          <h2>Selamat Datang</h2>
          <p className="ls">Gunakan email dan kata sandi yang diberikan administrator. Hubungi administrator bila lupa kata sandi.</p>
          {msg && <div className={`lm ${msg.t}`}>{msg.m}</div>}
          <label className="lf">Email<input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {pwField('Kata sandi', password, setPassword, 'current-password')}
          <div className="lr"><span /><button type="button" onClick={() => setMsg({ t: 'info', m: 'Hubungi administrator Ruang Data untuk mengatur ulang kata sandi Anda melalui menu Pengguna.' })}>Lupa kata sandi?</button></div>
          <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Memproses…' : 'Masuk'}</button>
          <p className="lalt">Belum punya akun? <button type="button" onClick={() => ganti('daftar')}>Daftar di sini</button></p>
        </>) : (<>
          <h2>Buat Akun</h2>
          <p className="ls">Akun baru akan aktif setelah disetujui administrator. Pengelola platform dapat langsung membuat akun admin dengan kode admin.</p>
          {msg && <div className={`lm ${msg.t}`}>{msg.m}</div>}
          <label className="lf">Nama lengkap<input type="text" required autoComplete="name" value={nama} onChange={(e) => setNama(e.target.value)} /></label>
          <label className="lf">Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          {pwField('Kata sandi (min. 8 karakter)', password, setPassword, 'new-password')}
          {pwField('Ulangi kata sandi', password2, setPassword2, 'new-password')}
          <label className="lchk"><input type="checkbox" checked={adminMode} onChange={(e) => setAdminMode(e.target.checked)} /> Saya pengelola platform (punya kode admin)</label>
          {adminMode && <label className="lf">Kode admin<input type="password" autoComplete="off" value={kode} onChange={(e) => setKode(e.target.value)} />
            <span className="lh">Kode admin = nilai AUTH_SECRET di Vercel (atau ADMIN_SIGNUP_CODE bila diatur). Bila email sudah terdaftar, akun tersebut dipulihkan menjadi admin dengan kata sandi baru ini.</span></label>}
          <button className="btn pri" type="submit" disabled={busy}>{busy ? 'Memproses…' : adminMode ? 'Daftar sebagai admin & masuk' : 'Daftar'}</button>
          <p className="lalt">Sudah punya akun? <button type="button" onClick={() => ganti('masuk')}>Masuk</button></p>
        </>)}
      </form>
    </AuthShell>
  );
}
