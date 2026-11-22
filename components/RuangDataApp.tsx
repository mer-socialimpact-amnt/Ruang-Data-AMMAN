'use client';
import { useEffect, useRef, useState } from 'react';
import schema from '@/lib/schema.json';
import type { AppUser } from '@/lib/auth';

type RdApi = { reload: () => void; route: () => void };
declare global { interface Window { __RD_BOOT?: (cfg: unknown) => RdApi; __RD_API?: RdApi } }

/** Markup kerangka identik dengan versi HTML; isinya dirender oleh engine (public/ruangdata-engine.js). */
const SHELL = "<div class=\"app\">\n  <aside class=\"side\">\n    <div class=\"brand\">\n      <img src=\"/logo-white.png\" alt=\"AMMAN\" width=\"112\" height=\"42\">\n      <div class=\"appname\"><b>Ruang Data</b><span>Satu Ruang, Beragam Data</span></div>\n    </div>\n    <nav class=\"nav\" id=\"nav\"></nav>\n    <div class=\"foot\" id=\"foot\"></div>\n  </aside>\n  <main class=\"main\">\n    <div class=\"top\">\n      <div><div class=\"crumb\" id=\"crumb\">Ruang Data</div><h1 id=\"title\">Beranda</h1></div>\n      <div class=\"filters\" id=\"filters\"></div>\n    </div>\n    <div class=\"content\" id=\"view\"></div>\n  </main>\n</div>\n<div class=\"ov\" id=\"ov\"></div>\n<aside class=\"drawer\" id=\"drawer\"><div class=\"dh\"><h2 id=\"dtitle\"></h2><button class=\"x\" data-act=\"close\">\u00d7</button></div><div class=\"db\" id=\"dbody\"></div></aside>\n\n<div class=\"toast\" id=\"toast\"></div>\n<div class=\"mov\" id=\"mov\"></div><div class=\"modal\" id=\"modal\"></div>";

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.__RD_BOOT) return resolve();
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Gagal memuat ' + src));
    document.body.appendChild(s);
  });
}
async function toDataURL(url: string) {
  const b = await (await fetch(url)).blob();
  return await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });
}

export default function RuangDataApp({ user }: { user: AppUser }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState('');
  const started = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Kerangka disisipkan sekali dan tidak dikelola React, agar isi yang dirender engine tidak tertimpa.
    if (host.current && !host.current.firstChild) host.current.innerHTML = SHELL;
    try { const z = localStorage.getItem('ruangdata_zoom'); if (z) document.documentElement.style.setProperty('--z', z); } catch { /* abaikan */ }
    if (window.__RD_API) { window.__RD_API.route(); setState('ready'); return; }
    if (started.current) return; started.current = true;
    (async () => {
      try {
        const [res, font, logo] = await Promise.all([
          fetch('/api/data', { cache: 'no-store' }),
          toDataURL('/fonts/inter-latin-wght-normal.woff2').catch(() => ''),
          toDataURL('/logo-white.png').catch(() => ''),
          loadScript('/ruangdata-engine.js?v=2'),
        ]);
        if (res.status === 401) { location.href = '/login'; return; }
        const js = await res.json();
        if (!res.ok) throw new Error(js.error || 'HTTP ' + res.status);
        window.__RD_API = window.__RD_BOOT!({
          data: js.data, schema, build: js.build, user,
          fontFace: font ? `@font-face{font-family:"Inter";src:url(${font}) format("woff2");font-weight:100 900;font-style:normal}` : '',
          logoData: logo,
        });
        setState('ready');
      } catch (e) { setErr((e as Error).message); setState('error'); }
    })();
  }, [user]);
  return (
    <>
      <div ref={host} />
      <div className={`boot ${state === 'ready' ? 'hide' : ''}`} aria-hidden={state === 'ready'}>
        <div className="bx">
          {state === 'error' ? (<><b style={{ color: 'var(--danger)' }}>Gagal memuat data</b><div>{err}</div><button className="btn" style={{ marginTop: 12 }} onClick={() => location.reload()}>Coba lagi</button></>)
            : (<><div className="sp" />Memuat Ruang Data…</>)}
        </div>
      </div>
    </>
  );
}
