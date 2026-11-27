/* Ruang Data — engine UI (identik dengan versi HTML). Dimuat oleh components/RuangDataApp.tsx */
window.__RD_BOOT = function (cfg) {
"use strict";
const BASE = cfg.data; const SCHEMA = cfg.schema; const BUILD = cfg.build; const USER = cfg.user; const AUTH = {user: USER};


/* ===================== util ===================== */
const $ = s => document.querySelector(s);
const esc = v => v == null ? '' : String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (n, d=0) => n == null || isNaN(n) ? '–' : Number(n).toLocaleString('id-ID', {maximumFractionDigits:d, minimumFractionDigits:d});
const pct = (n, d=0) => n == null || isNaN(n) ? '–' : (n*100).toLocaleString('id-ID',{maximumFractionDigits:d, minimumFractionDigits:d}) + '%';
const rp = n => n == null || isNaN(n) ? '–' : 'Rp' + Math.round(n).toLocaleString('id-ID');
const rpShort = n => n == null || isNaN(n) ? '–' : n >= 1e9 ? 'Rp' + fmt(n/1e9,1) + ' M' : n >= 1e6 ? 'Rp' + fmt(n/1e6,1) + ' jt' : rp(n);
const median = a => { const s = a.filter(x => x != null && !isNaN(x)).sort((x,y)=>x-y); if (!s.length) return null; const m = s.length>>1; return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
const uniq = a => [...new Set(a)];
const countBy = (a, f) => { const m = new Map(); a.forEach(x => { const k = f(x); m.set(k, (m.get(k)||0)+1); }); return m; };
function toast(msg, action){ const t=$('#toast'); t.innerHTML = esc(msg) + (action ? ` <button type="button" id="toastbtn">${esc(action.label)}</button>` : ''); t.style.display='block';
  if (action) $('#toastbtn').onclick = () => { t.style.display='none'; action.fn(); };
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.style.display='none', action ? 9000 : 2600); }

/* ===================== data store ===================== */
const DB = {};
const PK = {};
for (const [t, def] of Object.entries(SCHEMA)) PK[t] = def.cols.filter(c => c.pk).map(c => c.name);
function loadBase(){
  for (const [t, tb] of Object.entries(BASE)) DB[t] = tb.rows.map(r => Object.fromEntries(tb.cols.map((c,i) => [c, r[i]])));
  for (const t of Object.keys(SCHEMA)) if (!DB[t]) DB[t] = [];
}
let JOURNAL = [];
function storageSet(){ return true; }
const keyOf = (t, r) => PK[t].map(k => r[k]).join('|');
function applyOp(op){
  const arr = DB[op.t]; const k = keyOf(op.t, op.row);
  const i = arr.findIndex(r => keyOf(op.t, r) === k);
  if (op.op === 'del') { if (i >= 0) arr.splice(i,1); }
  else if (i >= 0) arr[i] = {...arr[i], ...op.row}; else arr.push({...op.row});
}
let SAVE_TXT = 'Tersinkron dengan database';
function setSave(txt){ SAVE_TXT = txt; const el = document.getElementById('savestate'); if (el) el.textContent = txt; }
let QUEUE = Promise.resolve();
function pushOps(ops){
  const body = JSON.stringify({ops: ops.map(o => ({t: o.t, op: o.op, row: o.row}))});
  setSave('Menyimpan…');
  QUEUE = QUEUE.then(async () => {
    try {
      const res = await fetch('/api/mutate', {method: 'POST', headers: {'content-type': 'application/json'}, body});
      const js = await res.json().catch(() => ({}));
      if (res.status === 401) { location.href = '/login'; return; }
      if (!res.ok) throw new Error(js.error || ('HTTP ' + res.status));
      setSave('Tersimpan ' + new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'}));
    } catch (e) {
      setSave('Gagal menyimpan');
      toast('Gagal menyimpan: ' + e.message + ' Data dimuat ulang dari server.');
      await reloadFromServer();
    }
  });
  return QUEUE;
}
async function reloadFromServer(silent){
  try {
    const r = await fetch('/api/data', {cache: 'no-store'}); if (r.status === 401) { location.href = '/login'; return; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json(); Object.keys(BASE).forEach(k => delete BASE[k]); Object.assign(BASE, d.data); BUILD.tanggal = d.build.tanggal;
    loadBase(); reindex(); rerender(); if (!silent) toast('Data dimuat ulang dari server'); setSave('Tersinkron dengan database');
  } catch (e) { toast('Gagal memuat data: ' + e.message); }
}
function commit(t, row, op='up'){ commitMany([{t, op, row}]); }
function commitMany(ops){
  ops.forEach(o => applyOp(o));
  reindex(); pushOps(ops);
}
/* ===================== PENGGUNA (versi Next.js · tersimpan di database) ===================== */
const ROLE_LABEL = {admin:'Admin', editor:'Editor', viewer:'Viewer', mitra:'Mitra'};
const ROLE_DESC = {admin:'Semua akses, termasuk referensi & pengguna', editor:'Input, ubah, dan hapus data program', viewer:'Hanya melihat, laporan, dan ekspor', mitra:'Hanya melihat peserta program mitranya'};
let USERS = null, USERS_ERR = '';
async function usersApi(body){
  const r = await fetch('/api/users', body ? {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)} : {cache:'no-store'});
  if (r.status === 401) { location.href = '/login'; throw new Error('Sesi berakhir'); }
  const js = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(js.error || ('HTTP ' + r.status));
  return js;
}
async function loadUsers(){
  try { USERS = (await usersApi()).users; USERS_ERR = ''; } catch (e) { USERS = []; USERS_ERR = e.message; }
  if ((location.hash || '').startsWith('#/pengguna')) rerender();
}
function genPw(){
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'; const b = new Uint32Array(12); crypto.getRandomValues(b);
  const s = [...b].map(x => a[x % a.length]).join(''); return `${s.slice(0,4)}-${s.slice(4,8)}-${s.slice(8)}`;
}
function pPengguna(){
  if (USER.role !== 'admin') return {title:'Pengguna', html:'<div class="empty">Halaman ini hanya untuk admin.</div>'};
  if (USERS === null) { loadUsers(); return {title:'Pengguna', crumb:'Akun & peran', html:'<div class="empty">Memuat daftar pengguna…</div>'}; }
  const all = USERS; const menunggu = all.filter(u => !u.role).length;
  return {title:'Pengguna', crumb:'Akun & peran (tersimpan di database)', html:`
    ${USERS_ERR ? `<div class="note" style="border-color:var(--danger)">Gagal memuat pengguna: ${esc(USERS_ERR)}</div>` : ''}
    ${menunggu ? `<div class="note" style="border-color:var(--lime-d,#B8C000)"><b>${fmt(menunggu)} pendaftaran menunggu persetujuan.</b> Klik <b>Setujui</b> untuk menetapkan peran, atau hapus bila tidak dikenal.</div>` : ''}
    <div class="grid g2" style="margin-bottom:16px">${Object.entries(ROLE_LABEL).map(([k, l]) => `<div class="card" style="padding:12px 16px"><b>${esc(l)}</b> <span class="muted small">· ${esc(ROLE_DESC[k])}</span></div>`).join('')}</div>
    <div class="toolbar"><span class="count">${fmt(all.length)} pengguna</span><span class="sp"></span><button class="btn" data-uact="refresh">Muat ulang</button><button class="btn pri" data-uact="new">${ico('plus')}Tambah pengguna</button></div>
    <div class="tbl-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Mitra</th><th>Status</th><th>Login terakhir</th><th></th></tr></thead><tbody>
    ${all.map(u => `<tr><td><b>${esc(u.nama || '–')}</b>${u.id === USER.id ? ' <span class="pill lime">Anda</span>' : ''}</td><td>${esc(u.email)}</td><td>${u.role ? `<span class="pill ${u.role==='admin'?'dark':''}">${esc(ROLE_LABEL[u.role] || u.role)}</span>` : '<span class="pill warn">Belum ada</span>'}</td>
      <td class="small">${esc(u.mitra_id ? ((IX.mitra.get(u.mitra_id)||{}).nama_mitra || u.mitra_id) : '–')}</td>
      <td>${!u.role ? '<span class="pill warn">Menunggu persetujuan</span>' : !u.aktif ? '<span class="pill">Nonaktif</span>' : u.terkunci ? '<span class="pill bad">Terkunci</span>' : u.wajib_ganti_sandi ? '<span class="pill warn">Menunggu ganti sandi</span>' : '<span class="pill ok">Aktif</span>'}</td>
      <td class="small muted">${u.login_terakhir ? esc(new Date(u.login_terakhir).toLocaleString('id-ID', {dateStyle:'medium', timeStyle:'short'})) : '–'}</td>
      <td style="white-space:nowrap;text-align:right">${u.role ? `<button class="btn sm" data-uact="edit" data-uid="${esc(u.id)}">Ubah</button>` : `<button class="btn sm pri" data-uact="edit" data-uid="${esc(u.id)}">Setujui</button>`} <button class="btn sm" data-uact="reset" data-uid="${esc(u.id)}">Atur sandi</button> ${u.id !== USER.id && u.role ? `<button class="btn sm" data-uact="toggle" data-uid="${esc(u.id)}">${u.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button> ` : ''}${u.id !== USER.id ? `<button class="btn icon" data-uact="del" data-uid="${esc(u.id)}" title="Hapus pengguna">${ico('trash')}</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="note" style="margin-top:14px">Kata sandi awal dan hasil atur ulang sampaikan langsung kepada pengguna. Pengguna yang mendaftar sendiri tampil sebagai <b>Menunggu persetujuan</b> sampai admin menetapkan perannya. Akun terkunci 15 menit setelah 5 kali salah kata sandi; atur ulang sandi untuk membuka kunci.</div>`};
}
function userForm(u, mode){
  const isNew = mode === 'new', pwOnly = mode === 'reset';
  const mitraOpts = DB.mitra.slice().sort((a,b) => a.nama_mitra.localeCompare(b.nama_mitra)).map(m => `<option value="${esc(m.mitra_id)}" ${u && u.mitra_id === m.mitra_id ? 'selected' : ''}>${esc(m.nama_mitra)}</option>`).join('');
  const approve = !isNew && !pwOnly && u && !u.role;
  openDrawer(isNew ? 'Tambah pengguna' : pwOnly ? 'Atur kata sandi' : approve ? 'Setujui pendaftaran' : 'Ubah pengguna', `<form class="form" id="ufrm" data-mode="${mode}" data-uid="${esc(u ? u.id : '')}">
    ${pwOnly ? `<div class="f full"><label>Pengguna</label><div><b>${esc(u.nama || u.email)}</b> <span class="muted">${esc(u.email)}</span></div></div>` : `
    <div class="f"><label>Nama lengkap <span class="rq">*</span></label><input type="text" name="nama" value="${esc(u ? u.nama || '' : '')}" required></div>
    <div class="f"><label>Email <span class="rq">*</span></label><input type="email" name="email" value="${esc(u ? u.email : '')}" ${isNew ? '' : 'readonly'} required></div>
    <div class="f"><label>Peran <span class="rq">*</span></label><select name="role">${Object.entries(ROLE_LABEL).map(([k, l]) => `<option value="${k}" ${u && u.role === k ? 'selected' : ((!u || !u.role) && k === 'viewer' ? 'selected' : '')}>${l}</option>`).join('')}</select><div class="h">${Object.entries(ROLE_DESC).map(([k, d]) => `${ROLE_LABEL[k]}: ${d}`).join(' · ')}</div></div>
    <div class="f"><label>Mitra (wajib untuk peran Mitra)</label><select name="mitra_id"><option value=""></option>${mitraOpts}</select></div>`}
    ${isNew || pwOnly ? `<div class="f"><label>Kata sandi ${isNew ? 'awal' : 'baru'} <span class="rq">*</span></label><input type="text" name="pw" minlength="8" required autocomplete="off" value="${genPw()}"><div class="h">Sudah dibuatkan acak; boleh diganti (min. 8 karakter). ${pwOnly && u.id === USER.id ? 'Ini kata sandi Anda sendiri.' : 'Pengguna wajib menggantinya saat login berikutnya.'}</div></div>` : ''}
    <div class="f full"><div class="err" id="uerr"></div></div>
    <div class="actions"><button type="button" class="btn" data-act="close">Batal</button><button type="submit" class="btn pri">${approve ? 'Setujui & aktifkan' : 'Simpan'}</button></div></form>`);
}
async function saveUserForm(f){
  const err = m => { const e = document.getElementById('uerr'); if (e) e.textContent = m; };
  const v = n => f.elements[n] ? f.elements[n].value.trim() : '';
  const mode = f.dataset.mode, id = f.dataset.uid || null;
  const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
  try {
    if (mode === 'reset') {
      if (v('pw').length < 8) return err('Kata sandi minimal 8 karakter.');
      await usersApi({action:'reset', id, password:v('pw')});
      if (id === USER.id) { location.href = '/login'; return; }
      closeDrawer(); toast('Kata sandi diperbarui. Sampaikan kepada pengguna: ' + v('pw')); await loadUsers(); return;
    }
    const role = v('role'), mitra_id = v('mitra_id') || null;
    if (!v('nama')) return err('Nama wajib diisi.');
    if (role === 'mitra' && !mitra_id) return err('Pilih mitra untuk peran Mitra.');
    if (mode === 'new') {
      if (v('pw').length < 8) return err('Kata sandi minimal 8 karakter.');
      await usersApi({action:'create', email:v('email'), nama:v('nama'), role, mitra_id, password:v('pw')});
      toast('Pengguna dibuat. Kata sandi awal: ' + v('pw'));
    } else {
      await usersApi({action:'update', id, nama:v('nama'), role, mitra_id});
      toast(f.querySelector('button[type=submit]').textContent.startsWith('Setujui') ? 'Pendaftaran disetujui' : 'Pengguna disimpan');
      if (id === USER.id && role !== USER.role) { location.reload(); return; }
    }
    closeDrawer(); await loadUsers();
  } catch (e) { err(e.message); } finally { btn.disabled = false; }
}
async function userAction(act, id){
  if (act === 'refresh') { USERS = null; rerender(); return; }
  if (act === 'new') return userForm(null, 'new');
  const u = (USERS || []).find(x => x.id === id); if (!u) return;
  if (act === 'edit') return userForm(u, 'edit');
  if (act === 'reset') return userForm(u, 'reset');
  try {
    if (act === 'toggle') { await usersApi({action:'toggle', id}); toast(u.aktif ? 'Pengguna dinonaktifkan' : 'Pengguna diaktifkan'); await loadUsers(); return; }
    if (act === 'del') {
      $('#modal').innerHTML = `<div class="mh"><span class="pill bad">Hapus</span>Hapus pengguna?</div><div class="mb"><b>${esc(u.nama || u.email)}</b> (${esc(u.email)}) tidak akan bisa masuk lagi. Data program tidak terpengaruh.</div>
        <div class="mf"><button class="btn" data-mact="cancel">Batal</button><button class="btn danger solid" data-uact="delok" data-uid="${esc(id)}">Hapus pengguna</button></div>`;
      $('#modal').style.display = 'block'; $('#mov').style.display = 'block'; return;
    }
    if (act === 'delok') { await usersApi({action:'delete', id}); closeModal(); toast('Pengguna dihapus'); await loadUsers(); }
  } catch (e) { closeModal(); toast(e.message); }
}
document.addEventListener('click', ev => { const b = ev.target.closest('[data-uact]'); if (!b) return; ev.preventDefault(); userAction(b.dataset.uact, b.dataset.uid); });
document.addEventListener('submit', ev => { if (ev.target.id === 'ufrm') { ev.preventDefault(); saveUserForm(ev.target); } });

function nextId(t){
  const pk = PK[t][0]; const ids = DB[t].map(r => r[pk]).filter(Boolean);
  const pre = {peserta:'PSR-',enrollment:'ENR-',tracer_ketenagakerjaan:'TRC-',baseline_peserta:'BSL-',usaha:'USH-',usaha_omzet_bulanan:'OMZ-',
    lembaga_komunitas:'LMB-',infrastruktur:'INF-',sertifikasi:'SRT-',pengukuran_kesehatan:'PKS-',kontribusi_lingkungan:'KTR-',peserta_usaha:'PUS-',
    usaha_legalitas:'LGL-',usaha_pemantauan:'PMU-',rumah_tangga:'RT-',mitra:'MTR-',mitra_kontak:'KTK-',capaian_agregat:'AGR-',log_isu_data:'ISU-',epp_kegiatan:'EPK-',donasi:'DON-',internship:'MAG-'}[t] || (t.slice(0,3).toUpperCase()+'-');
  let max = 0, width = 5;
  ids.forEach(id => { const m = String(id).match(/(\d+)$/); if (m && String(id).startsWith(pre)) { max = Math.max(max, +m[1]); width = m[1].length; } });
  return pre + String(max+1).padStart(width,'0');
}

/* ===================== reference & indexes ===================== */
const ENUM = {};
const IX = {};
function reindex(){
  
  if (typeof NIKKEC !== 'undefined') NIKKEC = null;
  for (const k in ENUM) delete ENUM[k];
  DB.ref_pilihan.forEach(r => (ENUM[r.kategori] = ENUM[r.kategori] || []).push(r));
  Object.values(ENUM).forEach(a => a.sort((x,y)=>(x.urutan||0)-(y.urutan||0)));
  const by = (t) => new Map(DB[t].map(r => [r[PK[t][0]], r]));
  IX.peserta = by('peserta'); IX.program = by('ref_program'); IX.wil = by('ref_wilayah'); IX.mitra = by('mitra');
  IX.enr = by('enrollment'); IX.usaha = by('usaha'); IX.area = new Map(DB.ref_ppm_area.map(a => [a.ppm_area_kode, a]));
  IX.rt = by('rumah_tangga'); IX.lembaga = by('lembaga_komunitas');
  const group = (t, f) => { const m = new Map(); DB[t].forEach(r => { const k = r[f]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); }); return m; };
  IX.enrByP = group('enrollment','peserta_id');
  IX.baseByE = new Map(DB.baseline_peserta.map(b => [b.enrollment_id, b]));
  IX.trcByE = group('tracer_ketenagakerjaan','enrollment_id');
  IX.puByE = group('peserta_usaha','enrollment_id');
  IX.puByU = group('peserta_usaha','usaha_id');
  IX.omzByU = group('usaha_omzet_bulanan','usaha_id');
  IX.legByU = group('usaha_legalitas','usaha_id');
  IX.pmByU = group('usaha_pemantauan','usaha_id');
  IX.srtByE = group('sertifikasi','enrollment_id');
  IX.pksByE = group('pengukuran_kesehatan','enrollment_id');
  IX.ktrByE = group('kontribusi_lingkungan','enrollment_id');
  IX.isuByR = group('log_isu_data','record_id');
  IX.asumsi = new Map(DB.asumsi_penghasilan.map(a => [a.pendidikan, a.upah_bulanan_asumsi]));
  IX.unverTracer = new Set(DB.log_isu_data.filter(i => i.jenis_isu === 'status_bekerja_tanpa_bukti' && i.status === 'terbuka').map(i => i.record_id));
  IX.omzSorted = new Map(); IX.omzByU.forEach((a,k) => IX.omzSorted.set(k, a.filter(o => o.omzet != null).sort((x,y)=> x.periode < y.periode ? -1 : 1)));
}
const lbl = (cat, code) => { if (code == null || code === '') return ''; const e = (ENUM[cat]||[]).find(x => x.kode === code); return e ? e.label : code; };
const wilOf = id => IX.wil.get(id) || {};
const kabOf = id => wilOf(id).kabupaten || '';
const ringOf = id => wilOf(id).ring || null;
const wilText = id => { const w = wilOf(id); if (!w.wilayah_id) return '–'; return [w.level === 'desa' ? w.nama : null, w.kecamatan ? 'Kec. ' + w.kecamatan : null, w.kabupaten].filter(Boolean).join(', '); };
const progOf = id => IX.program.get(id) || {};
const progText = id => { const p = progOf(id); return p.program_id ? (p.program + (p.sub_program ? ' – ' + p.sub_program : '')) : id; };
const PILAR = [
  {k:'HCD', n:'Human Capital Development', c:'#403836'},
  {k:'EE',  n:'Economic Empowerment', c:'#E9F40B'},
  {k:'ST',  n:'Sustainable Tourism', c:'#C7BDBA'},
  {k:'CP',  n:'Cross-pillar', c:'#000000'},
  {k:'EPP', n:'Employee Participation', c:'#8E8380'}];
const PC = Object.fromEntries(PILAR.map(p => [p.k, p.c]));
const WORK = new Set(['full_time','part_time','self_employed','internship']);

/* masking */
let SHOW_NIK = false;
const maskId = v => !v ? '–' : SHOW_NIK ? v : (String(v).length > 8 ? String(v).slice(0,4) + '•'.repeat(String(v).length-8) + String(v).slice(-4) : '••••');

/* ===================== global filters ===================== */
const F = {tahun:'', kab:'', ring:'', mitra:'', strict:true};
function enrFiltered(pilar){
  return DB.enrollment.filter(e => {
    const p = IX.peserta.get(e.peserta_id) || {}; const pr = progOf(e.program_id);
    if (pilar && pr.pilar_kode !== pilar) return false;
    if (F.tahun && String(e.tahun_mulai) !== F.tahun) return false;
    if (F.mitra && e.mitra_id !== F.mitra) return false;
    if (F.kab && kabOf(p.wilayah_id) !== F.kab) return false;
    if (F.ring && ringOf(p.wilayah_id) !== F.ring) return false;
    return true;
  });
}
function renderFilters(show){
  const el = $('#filters'); if (!show) { el.innerHTML = ''; return; }
  const years = uniq(DB.enrollment.map(e => e.tahun_mulai).filter(Boolean)).sort();
  const kabs = uniq(DB.ref_wilayah.filter(w => w.level==='kabupaten').map(w => w.nama)).sort();
  const mitra = [...DB.mitra].filter(m => DB.enrollment.some(e => e.mitra_id === m.mitra_id)).sort((a,b)=>a.nama_mitra.localeCompare(b.nama_mitra));
  const opt = (v, t, cur) => `<option value="${esc(v)}" ${cur===String(v)?'selected':''}>${esc(t)}</option>`;
  const n = ['tahun','kab','ring','mitra'].filter(k => F[k]).length;
  el.innerHTML = `<span class="fl">${ico('filter')}Filter${n ? ` (${n})` : ''}</span>
    <select data-f="tahun" class="${F.tahun?'set':''}" title="Tahun mulai"><option value="">Semua tahun</option>${years.map(y => opt(y,'Tahun '+y,F.tahun)).join('')}</select>
    <select data-f="kab" class="${F.kab?'set':''}" title="Kabupaten"><option value="">Semua kabupaten</option>${kabs.map(k => opt(k,k,F.kab)).join('')}</select>
    <select data-f="ring" class="${F.ring?'set':''}" title="Ring"><option value="">Semua ring</option>${(ENUM.ring||[]).map(r => opt(r.kode,r.label,F.ring)).join('')}</select>
    <select data-f="mitra" class="${F.mitra?'set':''}" title="Mitra"><option value="">Semua mitra</option>${mitra.map(m => opt(m.mitra_id,m.nama_mitra,F.mitra)).join('')}</select>
    ${n ? '<button class="btn sm ghost" data-act="clearf">Reset</button>' : ''}`;
}

/* ===================== charts ===================== */
function hbars(items, {fmtV = v => fmt(v), max} = {}){
  if (!items.length) return '<div class="empty">Belum ada data</div>';
  const m = max || Math.max(1, ...items.map(i => i.parts ? i.parts.reduce((s,p)=>s+p.v,0) : i.v));
  return `<div class="hb">${items.map(i => {
    const parts = i.parts || [{v:i.v, c:i.c || 'var(--dark)'}];
    const tot = parts.reduce((s,p)=>s+p.v,0);
    return `<div class="l" title="${esc(i.l)}">${esc(i.l)}</div><div class="t">${parts.map(p => `<span title="${esc(p.n||'')} ${fmtV(p.v)}" style="width:${p.v/m*100}%;background:${p.c};${p.c==='#E9F40B'?'box-shadow:inset 0 0 0 1px #c9d20a':''}"></span>`).join('')}</div><div class="n">${i.txt != null ? i.txt : fmtV(tot)}</div>`;
  }).join('')}</div>`;
}
function vstack(cols, series){
  const tot = cols.map(c => series.reduce((s,se) => s + (se.vals[c]||0), 0));
  const m = Math.max(1, ...tot);
  return `<div class="vb">${cols.map((c,i) => `<div class="c">${series.map(se => { const v = se.vals[c]||0; return v ? `<span title="${esc(se.n)} ${c}: ${fmt(v)}" style="height:${v/m*100}%;background:${se.c};${se.c==='#E9F40B'?'box-shadow:inset 0 0 0 1px #c9d20a':''}"></span>` : ''; }).join('')}<div class="tot" style="bottom:${tot[i]/m*100}%">${fmt(tot[i])}</div><div class="lab">${esc(c)}</div></div>`).join('')}</div>
  <div class="legend">${series.map(s => `<span><i style="background:${s.c};${s.c==='#E9F40B'?'box-shadow:inset 0 0 0 1px #c9d20a':''}"></i>${esc(s.n)}</span>`).join('')}</div>`;
}
function spark(vals, w=110, h=28){
  const v = vals.filter(x => x != null); if (v.length < 2) return '<span class="muted small">–</span>';
  const mx = Math.max(...v), mn = Math.min(...v), r = mx - mn || 1;
  const pts = v.map((x,i) => `${(i/(v.length-1)*(w-4)+2).toFixed(1)},${(h-2-(x-mn)/r*(h-4)).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="#403836" stroke-width="1.6"/><circle cx="${pts.split(' ').pop().split(',')[0]}" cy="${pts.split(' ').pop().split(',')[1]}" r="2.6" fill="#E9F40B" stroke="#403836"/></svg>`;
}
function lineChart(points, {w=640, h=200, fy = v => rpShort(v)} = {}){
  if (points.length < 1) return '<div class="empty">Belum ada data omzet</div>';
  const pad = {l:64, r:12, t:12, b:28}; const iw = w-pad.l-pad.r, ih = h-pad.t-pad.b;
  const ys = points.map(p => p.y); const mx = Math.max(...ys, 1), mn = 0;
  const X = i => pad.l + (points.length === 1 ? iw/2 : i/(points.length-1)*iw); const Y = v => pad.t + ih - (v-mn)/(mx-mn)*ih;
  const ticks = [0, .25, .5, .75, 1].map(f => mn + f*(mx-mn));
  const step = Math.ceil(points.length / 8);
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="max-width:${w}px">
    ${ticks.map(t => `<line x1="${pad.l}" x2="${w-pad.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="#E5E0DE"/><text x="${pad.l-6}" y="${Y(t)+4}" font-size="10" text-anchor="end" fill="#7A706C">${esc(fy(t))}</text>`).join('')}
    <polyline points="${points.map((p,i)=>`${X(i)},${Y(p.y)}`).join(' ')}" fill="none" stroke="#403836" stroke-width="2"/>
    ${points.map((p,i)=>`<circle cx="${X(i)}" cy="${Y(p.y)}" r="3.2" fill="#E9F40B" stroke="#403836"><title>${esc(p.x)}: ${esc(rp(p.y))}</title></circle>${i%step===0||i===points.length-1?`<text x="${X(i)}" y="${h-8}" font-size="10" text-anchor="middle" fill="#7A706C">${esc(p.x)}</text>`:''}`).join('')}
  </svg>`;
}

/* ===================== indicators ===================== */
function latestTracer(eid){
  const a = (IX.trcByE.get(eid) || []).slice().sort((x,y) => (y.tanggal_tracer||'').localeCompare(x.tanggal_tracer||'') || (y.tracer_id > x.tracer_id ? 1 : -1));
  return a[0] || null;
}
function tracerStats(enrs){
  let known = 0, work = 0, unver = 0; const incs = [], chg = []; const dist = new Map();
  enrs.forEach(e => {
    const t = latestTracer(e.enrollment_id); if (!t || !t.status_pekerjaan) return;
    const isUnver = IX.unverTracer.has(t.tracer_id);
    if (isUnver) unver++;
    if (F.strict && isUnver) return;
    known++; dist.set(t.status_pekerjaan, (dist.get(t.status_pekerjaan)||0)+1);
    if (WORK.has(t.status_pekerjaan)) {
      work++;
      if (t.penghasilan_bulanan > 0) {
        incs.push(t.penghasilan_bulanan);
        const b = IX.baseByE.get(e.enrollment_id) || {};
        const base = b.penghasilan_bulanan_sebelum > 0 ? b.penghasilan_bulanan_sebelum : IX.asumsi.get(b.pendidikan_terakhir);
        if (base > 0) chg.push((t.penghasilan_bulanan - base) / base);
      }
    }
  });
  return {known, work, rate: known ? work/known : null, avgInc: incs.length ? incs.reduce((a,b)=>a+b,0)/incs.length : null, medChg: median(chg), nChg: chg.length, unver, dist};
}
function omzetStats(u){
  const o = IX.omzSorted.get(u) || [];
  if (!o.length) return {n:0};
  const first = o[0], last = o[o.length-1]; const avg = o.reduce((s,x)=>s+x.omzet,0)/o.length;
  return {n:o.length, first, last, avg, chg: o.length >= 2 && first.omzet > 0 ? last.omzet/first.omzet - 1 : null, series:o.map(x=>x.omzet)};
}
const uniqP = enrs => new Set(enrs.map(e => e.peserta_id)).size;
function demo(enrs){
  const ps = [...new Set(enrs.map(e => e.peserta_id))].map(id => IX.peserta.get(id)).filter(Boolean);
  const fem = ps.filter(p => p.jenis_kelamin === 'perempuan').length, male = ps.filter(p => p.jenis_kelamin === 'laki_laki').length;
  return {n: ps.length, fem, male, femShare: fem+male ? fem/(fem+male) : null, dis: ps.filter(p => p.disabilitas).length,
          r1: ps.filter(p => ringOf(p.wilayah_id) === 'ring_1').length, ps};
}

/* ===================== navigation ===================== */

const ICON = {
  beranda:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  kerangka:'<circle cx="6" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="12" r="2.2"/><path d="M6 7.2v9.6M8.2 5H12a4 4 0 0 1 4 4v.8M8.2 19H12a4 4 0 0 0 4-4v-.8"/>',
  laporan:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 17v-3M12 17v-6M15 17v-2"/>',
  lintas:'<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6"/>',
  epp:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M9 11h6M12 8v6"/>',
  donasi:'<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8c-1.5-3-5-4-5-1.5S10 8 12 8zm0 0c1.5-3 5-4 5-1.5S14 8 12 8z"/>',
  internship:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5M22 9v6"/>',
  peserta:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
  keikutsertaan:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  usaha:'<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
  mitra:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  kualitas:'<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  referensi:'<path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5 2.5 2.5 0 0 0 6.5 24"/><path d="M8 7h8M8 11h6"/>',
  pengguna:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/><path d="M19 3l2 2-4 4"/>',
  pengaturan:'<path d="M12 3v12M7 10l5 5 5-5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M9 7V4h6v3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  alert:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5M4 19h16"/>',
};
const ico = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ''}</svg>`;
const searchBox = (ph, val, q) => `<span class="search">${ico('search')}<input type="search" placeholder="${esc(ph)}" value="${esc(val)}" data-q="${q}"></span>`;
const ROUTES = [
  {g:'Ringkasan'},
  {h:'beranda', t:'Beranda', i:'#E9F40B'},
  {h:'kerangka', t:'Kerangka Program & PPM', i:'#C7BDBA'},
  {h:'laporan', t:'Laporan Infografis', i:'#E9F40B'},
  {g:'Pilar'},
  {h:'pilar/HCD', t:'Human Capital Development', i:PC.HCD, b:true},
  {h:'pilar/EE', t:'Economic Empowerment', i:PC.EE},
  {h:'pilar/ST', t:'Sustainable Tourism', i:PC.ST},
  {h:'lintas', t:'Lintas Pilar', i:PC.CP, b:true},
  {g:'Program'},
  {h:'epp', t:'Employee Participation Program', i:'#fff', nomitra:true},
  {h:'donasi', t:'Donation', i:'#fff', nomitra:true},
  {h:'internship', t:'Internship', i:'#fff', nomitra:true},
  {g:'Data'},
  {h:'peserta', t:'Peserta', i:'#fff'},
  {h:'keikutsertaan', t:'Keikutsertaan Program', i:'#fff'},
  {h:'usaha', t:'Usaha / UMKM', i:'#fff'},
  {h:'mitra', t:'Mitra Pelaksana', i:'#fff'},
  {g:'Tata kelola'},
  {h:'kualitas', t:'Kualitas Data', i:'#fff'},
  {h:'referensi', t:'Referensi', i:'#fff'},
  
  {h:'pengguna', t:'Pengguna', i:'#fff', admin:true},
  {h:'pengaturan', t:'Impor / Ekspor', i:'#fff'},
];
function renderNav(cur){
  $('#nav').innerHTML = ROUTES.filter(r => (!r.admin || (typeof AUTH !== 'undefined' && AUTH.user && AUTH.user.role === 'admin')) && (!r.nomitra || !(typeof AUTH !== 'undefined' && AUTH.user && AUTH.user.role === 'mitra'))).map(r => r.g ? `<div class="grp">${esc(r.g)}</div>` :
    `<a href="#/${r.h}" class="${cur.startsWith(r.h)?'on':''}" title="${esc(r.t)}">${r.h.startsWith('pilar/') ? `<span class="sw" style="background:${r.i}"></span>` : ico(r.h)}${esc(r.t)}</a>`).join('');
  const RL = {admin: 'Admin', editor: 'Editor', viewer: 'Viewer', mitra: 'Mitra'};
  $('#foot').innerHTML = `<span class="who" title="${esc(USER.email)}">${esc(USER.nama || USER.email)}</span>${esc(RL[USER.role] || USER.role)}${USER.mitra_nama ? ' · ' + esc(USER.mitra_nama) : ''} · <a href="/akun/password">Ganti sandi</a> · <a href="/auth/signout">Keluar</a><br><span id="savestate">${esc(SAVE_TXT)}</span>`;
}
const STATE = {page:{}, q:{}, tab:{}};
function route(){
  const h = location.hash.replace(/^#\/?/, '') || 'beranda';
  renderNav(h);
  const [p, a] = h.split('/');
  const pages = {beranda:pBeranda, kerangka:pKerangka, pilar:()=>pPilar(a), lintas:pLintas, epp:pEPP, donasi:pDonasi, internship:pInternship, peserta:pPeserta, keikutsertaan:pEnrollment,
                 usaha:pUsaha, mitra:pMitra, kualitas:pKualitas, laporan:pLaporan, referensi:pReferensi, pengaturan:pPengaturan, pengguna:pPengguna };
  const fn = pages[p] || pBeranda;
  const out = fn();
  $('#title').textContent = out.title; $('#crumb').textContent = out.crumb || 'Social Impact AMMAN'; document.title = out.title + ' · Ruang Data';
  renderFilters(out.filters);
  $('#view').innerHTML = out.html;
  window.scrollTo(0,0);
}
const rerender = () => { const y = window.scrollY; route(); window.scrollTo(0,y); };

/* ===================== pages ===================== */
function kpi(k, v, s=''){ return `<div class="kpi"><div class="k">${esc(k)}</div><div class="v">${v}</div><div class="s">${s}</div></div>`; }

function pBeranda(){
  const enrs = enrFiltered(); const d = demo(enrs);
  const usahaN = new Set(enrs.flatMap(e => (IX.puByE.get(e.enrollment_id)||[]).map(x => x.usaha_id))).size;
  const ts = tracerStats(enrs.filter(e => ['HCD','ST'].includes(progOf(e.program_id).pilar_kode)));
  const areaItems = DB.ref_ppm_area.map(a => {
    const es = enrs.filter(e => progOf(e.program_id).ppm_area_kode === a.ppm_area_kode);
    const L = DB.lembaga_komunitas.filter(l => progOf(l.program_id).ppm_area_kode === a.ppm_area_kode).length;
    const I = DB.infrastruktur.filter(l => progOf(l.program_id).ppm_area_kode === a.ppm_area_kode).length;
    const parts = PILAR.map(p => ({n:p.n, c:p.c, v: uniqP(es.filter(e => progOf(e.program_id).pilar_kode === p.k))})).filter(x => x.v);
    return {l: `${a.ppm_area_kode}. ${a.nama_kepmen}`, parts: parts.length ? parts : [{v:0,c:'#ccc'}], txt: (uniqP(es) ? fmt(uniqP(es)) : (L||I) ? `${L} lbg · ${I} inf` : '0')};
  });
  const pil = PILAR.slice(0,3).map(p => { const es = enrs.filter(e => progOf(e.program_id).pilar_kode === p.k); const dd = demo(es);
    return {l: p.n, parts:[{n:'Laki-laki', v:dd.male, c:'#403836'}, {n:'Perempuan', v:dd.fem, c:'#E9F40B'}, {n:'Tidak tercatat', v:dd.n-dd.male-dd.fem, c:'#C7BDBA'}], txt: fmt(dd.n)}; });
  const years = uniq(enrs.map(e => e.tahun_mulai).filter(Boolean)).sort();
  const series = PILAR.slice(0,3).map(p => ({n:p.n, c:p.c, vals: Object.fromEntries(years.map(y => [y, enrs.filter(e => e.tahun_mulai===y && progOf(e.program_id).pilar_kode===p.k).length]))}));
  const ringI = ['ring_1','ring_2','ring_3', null].map(r => ({l: r ? lbl('ring', r) : 'Belum terpetakan', v: d.ps.filter(p => ringOf(p.wilayah_id) === r).length, c: r==='ring_1'?'#E9F40B':r==='ring_2'?'#403836':r==='ring_3'?'#C7BDBA':'#E5E0DE'}));
  const kabI = [...countBy(d.ps, p => kabOf(p.wilayah_id) || 'Tidak tercatat')].sort((a,b)=>b[1]-a[1]).map(([l,v]) => ({l, v}));
  const isuOpen = DB.log_isu_data.filter(i => i.status === 'terbuka').length;
  const nikOk = d.ps.filter(p => p.status_nik === 'valid').length;
  return {title:'Beranda', crumb:'Ringkasan lintas pilar', filters:true, html: `
    ${isuOpen ? `<div class="note warn"><b>${fmt(isuOpen)} isu kualitas data terbuka.</b> Angka capaian di bawah dihitung dari data yang ada; status bekerja tanpa bukti ${F.strict ? '<b>dikecualikan</b>' : 'ikut dihitung'}. <a href="#/kualitas">Lihat kualitas data →</a></div>` : ''}
    <div class="kpis">
      ${kpi('Penerima unik', fmt(d.n), `${fmt(enrs.length)} keikutsertaan`)}
      ${kpi('Perempuan', pct(d.femShare), `${fmt(d.fem)} orang`)}
      ${kpi('Disabilitas', fmt(d.dis), 'tercatat eksplisit')}
      ${kpi('Ring 1', pct(d.n ? d.r1/d.n : null), `${fmt(d.r1)} orang · lingkar tambang`)}
      ${kpi('Bekerja (HCD+ST)', pct(ts.rate), `${fmt(ts.work)} dari ${fmt(ts.known)} tracer`)}
      ${kpi('Usaha dibina', fmt(usahaN), 'UMKM peserta EE')}
      ${kpi('NIK valid', pct(d.n ? nikOk/d.n : null), `${fmt(d.n - nikOk)} perlu perbaikan`)}
    </div>
    <div class="card"><h3>Penerima manfaat unik per program area PPM</h3><div class="sub">Kepmen ESDM 1824 K/30/MEM/2018 · warna = pilar. Area 6–8 belum memiliki data peserta/lembaga/infrastruktur.</div>
      ${hbars(areaItems)}<div class="legend" style="margin-top:12px">${PILAR.map(p => `<span><i style="background:${p.c};${p.k==='EE'?'box-shadow:inset 0 0 0 1px #c9d20a':''}"></i>${p.n}</span>`).join('')}</div></div>
    <div class="grid g2 sect">
      <div class="card"><h3>Penerima manfaat per pilar & gender</h3><div class="sub">Orang unik per pilar (satu orang bisa muncul di lebih dari satu pilar)</div>${hbars(pil)}
        <div class="legend" style="margin-top:12px"><span><i style="background:#403836"></i>Laki-laki</span><span><i style="background:#E9F40B;box-shadow:inset 0 0 0 1px #c9d20a"></i>Perempuan</span><span><i style="background:#C7BDBA"></i>Tidak tercatat</span></div></div>
      <div class="card"><h3>Keikutsertaan per tahun mulai</h3><div class="sub">Jumlah enrollment</div>${vstack(years, series)}</div>
    </div>
    <div class="grid g2 sect">
      <div class="card"><h3>Sebaran Ring wilayah</h3><div class="sub">Berdasarkan kecamatan KTP · Ring 1 = Maluk, Sekongkang, Jereweh (asumsi, validasi dengan RIPPM)</div>${hbars(ringI)}</div>
      <div class="card"><h3>Sebaran kabupaten</h3><div class="sub">Penerima manfaat unik</div>${hbars(kabI)}</div>
    </div>`};
}

function pKerangka(){
  const enrs = enrFiltered();
  const byProg = new Map(); enrs.forEach(e => { if (!byProg.has(e.program_id)) byProg.set(e.program_id, []); byProg.get(e.program_id).push(e); });
  const areas = [...DB.ref_ppm_area, {ppm_area_kode:null, nama_kepmen:'Di luar PPM / belum terpetakan', nama_mapping:'Employee Participation Program & penampung'}];
  const html = areas.map(a => {
    const progs = DB.ref_program.filter(p => (p.ppm_area_kode ?? null) === a.ppm_area_kode);
    const es = progs.flatMap(p => byProg.get(p.program_id) || []);
    const L = DB.lembaga_komunitas.filter(l => progs.some(p => p.program_id === l.program_id)).length;
    const I = DB.infrastruktur.filter(l => progs.some(p => p.program_id === l.program_id)).length;
    const rows = progs.map(p => { const pe = byProg.get(p.program_id) || []; const d = demo(pe);
      return `<tr><td><span class="pill" style="background:${PC[p.pilar_kode]};color:${['HCD','CP'].includes(p.pilar_kode)?'#fff':'#000'}">${esc(p.pilar_kode)}</span></td>
        <td><b>${esc(p.program)}</b>${p.sub_program ? `<div class="small muted">${esc(p.sub_program)}</div>` : ''}<div class="small muted">${esc(p.program_id)}</div></td>
        <td class="small">${esc(p.sdgs||'–')}</td>
        <td class="num">${pe.length ? fmt(pe.length) : '<span class="pill warn">Belum ada data</span>'}</td><td class="num">${pe.length ? fmt(d.n) : ''}</td>
        <td class="num">${pe.length ? pct(d.femShare) : ''}</td><td class="num">${pe.length ? fmt(d.r1) : ''}</td></tr>`; }).join('');
    return `<div class="area"><div class="ah"><div class="no">${a.ppm_area_kode ?? '–'}</div><div><div class="nm">${esc(a.nama_kepmen)}</div><div class="mp">Program Mapping: ${esc(a.nama_mapping)}</div></div>
      <div class="st"><b>${fmt(uniqP(es))}</b>penerima unik${L||I ? ` · ${L} lembaga · ${I} infrastruktur` : ''}</div></div>
      ${progs.length ? `<div style="overflow:auto"><table><thead><tr><th>Pilar</th><th>Program / sub-program</th><th>SDGs</th><th class="num">Keikutsertaan</th><th class="num">Orang unik</th><th class="num">% perempuan</th><th class="num">Ring 1</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty" style="margin:12px">Belum ada program yang dipetakan ke area ini</div>'}</div>`;
  }).join('');
  return {title:'Kerangka Program & Program Area PPM', crumb:'Pilar → Program Area PPM → Program → Sub-program', filters:true, html:`
    <div class="note">Setiap program di Program Mapping Social Impact dipetakan ke salah satu dari 8 program utama PPM (Kepmen ESDM 1824 K/30/MEM/2018). Baris "Belum ada data" adalah sub-program yang sudah ada di kerangka tetapi belum memiliki data peserta.</div>
    <div class="tree">${html}</div>`};
}

function subProgTable(pc, enrs, extra){
  const progs = DB.ref_program.filter(p => p.pilar_kode === pc);
  return `<div class="tbl-wrap"><table><thead><tr><th>Program / sub-program</th><th>Area PPM</th><th class="num">Keikutsertaan</th><th class="num">Orang unik</th><th class="num">% perempuan</th><th class="num">Disabilitas</th>${extra.heads.map(h => `<th class="num">${h}</th>`).join('')}</tr></thead><tbody>
    ${progs.map(p => { const es = enrs.filter(e => e.program_id === p.program_id); const d = demo(es);
      return `<tr class="click" data-go="#/keikutsertaan?program=${esc(p.program_id)}"><td><b>${esc(p.program)}</b>${p.sub_program?`<div class="small muted">${esc(p.sub_program)}</div>`:''}</td><td class="small">${p.ppm_area_kode ? esc(p.ppm_area_kode + '. ' + (IX.area.get(p.ppm_area_kode)||{}).nama_mapping) : '<span class="pill warn">Belum terpetakan</span>'}</td>
      <td class="num">${es.length ? fmt(es.length) : '<span class="pill">0</span>'}</td><td class="num">${fmt(d.n)}</td><td class="num">${pct(d.femShare)}</td><td class="num">${fmt(d.dis)}</td>${extra.cells(es).map(c => `<td class="num">${c}</td>`).join('')}</tr>`; }).join('')}
  </tbody></table></div>`;
}

const ORANG_PER_KK = 4; // rata-rata anggota keluarga per penerima manfaat
const kpiTerdampak = n => kpi('Total orang terdampak', fmt(n * ORANG_PER_KK), `${fmt(n)} penerima unik × ${ORANG_PER_KK} (rata-rata orang per keluarga)`);
function pPilar(pc){
  const P = PILAR.find(p => p.k === pc) || PILAR[0];
  const enrs = enrFiltered(pc); const d = demo(enrs);
  let kp = '', body = '';
  if (pc === 'HCD' || pc === 'ST') {
    const ts = tracerStats(enrs);
    const edu = [...countBy(enrs.map(e => IX.baseByE.get(e.enrollment_id)).filter(b => b && b.pendidikan_terakhir), b => b.pendidikan_terakhir)]
      .sort((a,b) => (ENUM.pendidikan||[]).findIndex(x=>x.kode===a[0]) - (ENUM.pendidikan||[]).findIndex(x=>x.kode===b[0])).map(([k,v]) => ({l: lbl('pendidikan',k), v}));
    const st = [...ts.dist].sort((a,b)=>b[1]-a[1]).map(([k,v]) => ({l: lbl('status_pekerjaan',k), v, c: WORK.has(k) ? '#403836' : '#C7BDBA'}));
    const nSrt = enrs.reduce((s,e)=>s+(IX.srtByE.get(e.enrollment_id)||[]).length,0);
    kp = kpi('Penerima unik', fmt(d.n), `${fmt(enrs.length)} keikutsertaan`) + kpiTerdampak(d.n) + kpi('Perempuan', pct(d.femShare), `${fmt(d.fem)} orang`) +
         kpi('Tingkat bekerja', pct(ts.rate), `${fmt(ts.work)} dari ${fmt(ts.known)} tracer${ts.unver ? ` · ${fmt(ts.unver)} belum terverifikasi` : ''}`) +
         kpi('Rata-rata penghasilan (bekerja)', rpShort(ts.avgInc), 'per bulan, tracer terakhir') +
         kpi('Median perubahan penghasilan', ts.medChg == null ? '–' : (ts.medChg>=0?'+':'') + pct(ts.medChg), `n = ${fmt(ts.nChg)} · baseline aktual/asumsi BPS`) +
         kpi('Sertifikasi tercatat', fmt(nSrt), nSrt ? '' : 'tabel siap diisi');
    const extra = {heads:['Tracer','% bekerja','Rata-rata penghasilan','Median Δ penghasilan'], cells: es => { const s = tracerStats(es); return [fmt(s.known), pct(s.rate), rpShort(s.avgInc), s.medChg==null?'–':(s.medChg>=0?'+':'')+pct(s.medChg)]; }};
    let module = '';
    if (pc === 'HCD') {
      const pk = enrs.flatMap(e => IX.pksByE.get(e.enrollment_id) || []);
      const gz = [...countBy(pk.filter(x => x.status_gizi), x => x.status_gizi)].map(([k,v]) => ({l:lbl('status_gizi',k), v, c: k==='normal'?'#403836':'#E9F40B'}));
      module = `<div class="card"><h3>Modul kesehatan (stunting, KLA, screening)</h3><div class="sub">Sumber: tabel pengukuran_kesehatan</div>${pk.length ? hbars(gz) : `<div class="empty">Belum ada data pengukuran. Program Stunting KSB, Stunting PASTI, KLA, dan Health Screening sudah tersedia di kerangka; tambahkan data lewat detail keikutsertaan.</div>`}</div>`;
    } else {
      const kt = enrs.flatMap(e => IX.ktrByE.get(e.enrollment_id) || []);
      module = `<div class="card"><h3>Kontribusi lingkungan & konservasi</h3><div class="sub">Coral reef, seagrass, mangrove, turtle, environment conservation</div>${kt.length ? hbars([...countBy(kt, k => k.jenis_kegiatan + ' (' + (k.satuan||'') + ')')].map(([l]) => ({l, v: kt.filter(k => k.jenis_kegiatan + ' (' + (k.satuan||'') + ')' === l).reduce((s,k)=>s+(k.volume||0),0)}))) : `<div class="empty">Belum ada data kontribusi. Sub-program Sustainable Environmental Management (area PPM 6) sudah tersedia di kerangka.</div>`}</div>`;
    }
    body = `<div class="card"><h3>Kinerja per sub-program</h3><div class="sub">Klik baris untuk melihat daftar keikutsertaan</div>${subProgTable(pc, enrs, extra)}</div>
      <div class="grid g2 sect"><div class="card"><h3>Status pekerjaan (tracer terakhir)</h3><div class="sub">${F.strict ? 'Status bekerja tanpa jabatan/institusi/penghasilan dikecualikan' : 'Termasuk status yang belum terverifikasi'}</div>${hbars(st)}</div>
      <div class="card"><h3>Pendidikan terakhir saat mendaftar</h3><div class="sub">Dari baseline peserta</div>${hbars(edu)}</div></div>
      <div class="sect">${module}</div>`;
  } else if (pc === 'EE') {
    const uids = [...new Set(enrs.flatMap(e => (IX.puByE.get(e.enrollment_id)||[]).map(x => x.usaha_id)))];
    const us = uids.map(id => IX.usaha.get(id)).filter(Boolean);
    const os = us.map(u => ({u, s: omzetStats(u.usaha_id)}));
    const withO = os.filter(x => x.s.n >= 2); const med = median(withO.map(x => x.s.chg));
    const legal = (ENUM.jenis_legalitas||[]).map(j => { const have = us.filter(u => (IX.legByU.get(u.usaha_id)||[]).some(l => l.jenis_legalitas===j.kode && l.dimiliki)).length; return {l:j.label, v: have, txt: `${fmt(have)} (${pct(us.length? have/us.length : null)})`}; });
    const sek = [...countBy(us, u => u.sektor_usaha || null)].sort((a,b)=>b[1]-a[1]).map(([k,v]) => ({l: k ? lbl('sektor_usaha',k) : 'Tidak tercatat', v}));
    const stop = us.filter(u => (IX.pmByU.get(u.usaha_id)||[]).some(p => ['vakum','berhenti'].includes(p.status_usaha))).length;
    kp = kpi('Penerima unik', fmt(d.n), `${fmt(enrs.length)} keikutsertaan`) + kpiTerdampak(d.n) + kpi('Perempuan', pct(d.femShare), `${fmt(d.fem)} orang`) +
         kpi('Usaha dibina', fmt(us.length), `${fmt(withO.length)} dengan omzet ≥ 2 bulan`) +
         kpi('Median perubahan omzet', med == null ? '–' : (med>=0?'+':'') + pct(med), 'bulan pertama vs terakhir tercatat') +
         kpi('Usaha ber-NIB', pct(us.length ? us.filter(u => (IX.legByU.get(u.usaha_id)||[]).some(l => l.jenis_legalitas==='nib' && l.dimiliki)).length/us.length : null), 'dari usaha dibina') +
         kpi('Usaha vakum/berhenti', fmt(stop), 'tercatat di pemantauan');
    const extra = {heads:['Usaha','Omzet ≥2 bln','Median Δ omzet'], cells: es => { const ids = [...new Set(es.flatMap(e => (IX.puByE.get(e.enrollment_id)||[]).map(x=>x.usaha_id)))]; const ss = ids.map(omzetStats).filter(s => s.n >= 2); const m = median(ss.map(s => s.chg)); return [fmt(ids.length), fmt(ss.length), m==null?'–':(m>=0?'+':'')+pct(m)]; }};
    const top = withO.sort((a,b) => (b.s.last.omzet||0) - (a.s.last.omzet||0)).slice(0, 12);
    body = `<div class="card"><h3>Kinerja per sub-program</h3><div class="sub">Klik baris untuk melihat daftar keikutsertaan</div>${subProgTable(pc, enrs, extra)}</div>
      <div class="grid g2 sect"><div class="card"><h3>Legalitas usaha</h3><div class="sub">Usaha yang memiliki izin (kosong = belum diketahui, bukan "tidak")</div>${hbars(legal, {max: us.length || 1})}</div>
      <div class="card"><h3>Sektor usaha</h3><div class="sub">Usaha dibina</div>${hbars(sek)}</div></div>
      <div class="card sect"><h3>Usaha dengan omzet tercatat (12 teratas menurut omzet terakhir)</h3><div class="sub">Klik untuk detail & grafik omzet</div>
      <div class="tbl-wrap"><table><thead><tr><th>Usaha</th><th>Sektor</th><th class="num">Bulan</th><th>Periode</th><th class="num">Omzet awal</th><th class="num">Omzet terakhir</th><th class="num">Δ</th><th>Tren</th></tr></thead><tbody>
      ${top.map(({u,s}) => `<tr class="click" data-usaha="${esc(u.usaha_id)}"><td><b>${esc(u.nama_usaha || '(tanpa nama)')}</b><div class="small muted">${esc(u.usaha_id)}</div></td><td>${esc(lbl('sektor_usaha',u.sektor_usaha))}</td><td class="num">${s.n}</td><td class="small">${esc(s.first.periode.slice(0,7))} → ${esc(s.last.periode.slice(0,7))}</td><td class="num">${rp(s.first.omzet)}</td><td class="num">${rp(s.last.omzet)}</td><td class="num">${s.chg==null?'–':(s.chg>=0?'+':'')+pct(s.chg)}</td><td>${spark(s.series)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }
  return {title: P.n, crumb: 'Pilar ' + P.k, filters:true, html: `
    <div class="toolbar"><span class="pill" style="background:${P.c};color:${pc==='HCD'?'#fff':'#000'}">${P.k}</span><span class="muted small">Program area PPM: ${uniq(DB.ref_program.filter(p=>p.pilar_kode===pc).map(p=>p.ppm_area_kode).filter(Boolean)).sort().map(k => esc(k + '. ' + IX.area.get(k).nama_mapping)).join(' · ')}</span><span class="sp"></span>
    ${pc !== 'EE' ? `<label class="small"><input type="checkbox" data-act="strict" ${F.strict?'checked':''}> Kecualikan status bekerja tanpa bukti</label>` : ''}</div>
    <div class="kpis">${kp}</div>${body}`};
}

function pLintas(){
  const tab = STATE.tab.lintas || 'lembaga';
  const t = tab === 'lembaga' ? 'lembaga_komunitas' : tab === 'infra' ? 'infrastruktur' : 'capaian_agregat';
  const rows = DB[t];
  const cols = {lembaga_komunitas:['lembaga_id','nama_lembaga','jenis_lembaga','program_id','wilayah_id','tahun_dibentuk','berbadan_hukum','jumlah_anggota','tingkat_kemandirian'],
                infrastruktur:['infrastruktur_id','nama_aset','jenis_infrastruktur','program_id','wilayah_id','tahun_selesai','nilai_investasi','status_aset','penerima_manfaat_jiwa'],
                capaian_agregat:['capaian_id','nama_kegiatan','program_id','tahun','jumlah_penerima','satuan','catatan']}[t];
  return {title:'Lintas Pilar', crumb:'Program area PPM 7 (kelembagaan) & 8 (infrastruktur), capaian agregat', html:`
    <div class="note">Area PPM 7 dan 8 tidak berbasis peserta perorangan, sehingga dicatat sebagai <b>lembaga</b> dan <b>aset infrastruktur</b>. Capaian agregat menampung kegiatan tanpa daftar nama (mis. donasi massal).</div>
    <div class="tabs">${[['lembaga','Kelembagaan Komunitas (PPM 7)'],['infra','Infrastruktur (PPM 8)'],['agregat','Capaian Agregat']].map(([k,n]) => `<a data-tab="lintas:${k}" class="${tab===k?'on':''}">${n}</a>`).join('')}</div>
    <div class="toolbar"><span class="muted small">${fmt(rows.length)} baris</span><span class="sp"></span><button class="btn pri" data-new="${t}">+ Tambah ${esc(SCHEMA[t].label)}</button></div>
    ${genericTable(t, rows, cols)}`};
}

/* ===================== program non-pilar: EPP, Donation, Internship ===================== */
const qSel = (key, k, q, opts, ph) => `<select data-q="${key}:${k}"><option value="">${esc(ph)}</option>${opts.map(([v,t]) => `<option value="${esc(v)}" ${String(q[k]||'')===String(v)?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
const sumOf = (rows, f) => rows.reduce((s, r) => s + (Number(r[f]) || 0), 0);
const BULAN = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function fitPage(t, n, per = 50){ if ((STATE.page[t] || 0) * per >= n) STATE.page[t] = 0; }
function topN(m, n = 10){ return [...m].sort((a, b) => b[1] - a[1]).slice(0, n); }

function pEPP(){
  const q = STATE.q.epp || {};
  const all = DB.epp_kegiatan;
  const years = uniq(all.map(r => (r.tanggal || '').slice(0, 4)).filter(Boolean)).sort();
  const s = (q.s || '').trim().toLowerCase();
  const rows = all.filter(r => (!q.th || (r.tanggal || '').startsWith(q.th)) && (!q.dom || r.domain === q.dom) && (!q.ring || r.ring === q.ring) &&
    (!s || [r.nama_kegiatan, r.inisiator, r.kecamatan, r.kabupaten, r.epp_id].some(v => (v || '').toLowerCase().includes(s))))
    .sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
  const vol = sumOf(rows, 'jumlah_relawan'), jam = sumOf(rows, 'jam_relawan'), pm = sumOf(rows, 'penerima_manfaat');
  const r1 = rows.filter(r => r.ring === 'ring_1').length;
  const dom = [...countBy(rows, r => r.domain || null)].sort((a, b) => b[1] - a[1]).map(([k, n]) => {
    const rs = rows.filter(r => (r.domain || null) === k); return {l: k ? lbl('epp_domain', k) : 'Tidak tercatat', v: n, txt: `${fmt(n)} keg. · ${fmt(sumOf(rs, 'penerima_manfaat'))} PM`}; });
  const months = uniq(rows.map(r => (r.tanggal || '').slice(0, 7)).filter(Boolean)).sort();
  const mLab = m => BULAN[+m.slice(5, 7) - 1] + (q.th ? '' : ' ' + m.slice(2, 4));
  const ringSeries = [['ring_1', '#E9F40B'], ['ring_2', '#403836'], ['ring_3', '#C7BDBA']].map(([k, c]) => ({n: lbl('ring', k), c,
    vals: Object.fromEntries(months.map(m => [mLab(m), rows.filter(r => (r.tanggal || '').startsWith(m) && r.ring === k).length]))}));
  const ini = topN(countBy(rows, r => r.inisiator || 'Tidak tercatat')).map(([l, v]) => ({l, v}));
  const ringPm = (ENUM.ring || []).map(e => ({l: e.label, v: sumOf(rows.filter(r => r.ring === e.kode), 'penerima_manfaat'), c: e.kode === 'ring_1' ? '#E9F40B' : '#403836'}));
  fitPage('epp_kegiatan', rows.length);
  return {title: 'Employee Participation Program', crumb: 'Kegiatan relawan karyawan (employee volunteering)', html: `
    <div class="toolbar">${qSel('epp', 'th', q, years.map(y => [y, 'Tahun ' + y]), 'Semua tahun')}${qSel('epp', 'dom', q, (ENUM.epp_domain || []).map(e => [e.kode, e.label]), 'Semua domain')}${qSel('epp', 'ring', q, (ENUM.ring || []).map(e => [e.kode, e.label]), 'Semua ring')}</div>
    <div class="kpis">${kpi('Kegiatan', fmt(rows.length), `${fmt(months.length)} bulan aktif`) + kpi('Partisipasi relawan', fmt(vol), 'jumlah keterlibatan karyawan, bukan orang unik') +
      kpi('Jam relawan', fmt(jam), `rata-rata ${fmt(vol ? jam / vol : 0, 1)} jam per relawan`) + kpi('Penerima manfaat', fmt(pm), `median ${fmt(median(rows.map(r => r.penerima_manfaat)))} per kegiatan · dijumlahkan per kegiatan, orang yang sama bisa terhitung berulang`) +
      kpi('Kegiatan di Ring 1', pct(rows.length ? r1 / rows.length : null), `${fmt(r1)} kegiatan`) + kpi('Domain kegiatan', fmt(uniq(rows.map(r => r.domain).filter(Boolean)).length), 'bidang berbeda')}</div>
    <div class="grid g2"><div class="card"><h3>Kegiatan per domain</h3><div class="sub">Jumlah kegiatan · penerima manfaat (PM)</div>${hbars(dom)}</div>
      <div class="card"><h3>Kegiatan per bulan dan ring</h3><div class="sub">Berdasarkan tanggal kegiatan</div>${months.length ? vstack(months.map(mLab), ringSeries) : '<div class="empty">Belum ada data</div>'}</div></div>
    <div class="grid g2 sect"><div class="card"><h3>Penerima manfaat per ring</h3><div class="sub">Jumlah penerima manfaat langsung</div>${hbars(ringPm)}</div>
      <div class="card"><h3>Inisiator teratas</h3><div class="sub">Jumlah kegiatan per pengusul</div>${hbars(ini)}</div></div>
    <div class="card sect"><div class="toolbar" style="margin:0 0 10px">${searchBox('Cari kegiatan, inisiator, atau kecamatan…', q.s || '', 'epp:s')}<span class="sp"></span><span class="count">${fmt(rows.length)} kegiatan</span><button class="btn pri" data-new="epp_kegiatan">${ico('plus')}Kegiatan EPP</button></div>
      ${genericTable('epp_kegiatan', rows, ['epp_id', 'tanggal', 'nama_kegiatan', 'domain', 'kecamatan', 'ring', 'inisiator', 'jumlah_relawan', 'jam_relawan', 'penerima_manfaat'], {del: true})}</div>`};
}

function pDonasi(){
  const q = STATE.q.don || {};
  const all = DB.donasi;
  const yOf = r => (r.tanggal_komite || r.tanggal_diterima || '').slice(0, 4);
  const years = uniq(all.map(yOf).filter(Boolean)).sort();
  const s = (q.s || '').trim().toLowerCase();
  const rows = all.filter(r => (!q.th || yOf(r) === q.th) && (!q.dom || r.domain === q.dom) && (!q.ring || r.ring === q.ring) && (!q.st || r.status === q.st) &&
    (!s || [r.nama_kegiatan, r.deskripsi, r.kode_proyek, r.lokasi, r.diusulkan_oleh, r.donasi_id].some(v => (v || '').toLowerCase().includes(s))))
    .sort((a, b) => (b.tanggal_komite || '').localeCompare(a.tanggal_komite || '') || (a.donasi_id).localeCompare(b.donasi_id));
  const ok = rows.filter(r => ['disetujui', 'disalurkan'].includes(r.status));
  const vOk = sumOf(ok, 'nilai_disetujui'), withProp = ok.filter(r => r.nilai_proposal > 0);
  const vProp = sumOf(withProp, 'nilai_proposal'), vOkProp = sumOf(withProp, 'nilai_disetujui');
  const r1 = sumOf(ok.filter(r => r.ring === 'ring_1'), 'nilai_disetujui');
  const by = (f, labelF) => [...countBy(ok, r => r[f] || null)].map(([k]) => ({l: labelF(k), v: sumOf(ok.filter(r => (r[f] || null) === k), 'nilai_disetujui')})).sort((a, b) => b.v - a.v);
  const rippm = by('rippm_kode', k => { if (!k) return 'Tidak tercatat'; const r = ok.find(x => x.rippm_kode === k); return k + ' · ' + (r && r.rippm_uraian || ''); });
  const domv = by('domain', k => k ? lbl('donasi_domain', k) : 'Tidak tercatat');
  const lok = by('lokasi', k => k || 'Tidak tercatat');
  const met = by('metode_pembayaran', k => k ? lbl('metode_pembayaran', k) : 'Tidak tercatat');
  const fv = {fmtV: v => rpShort(v)};
  fitPage('donasi', rows.length);
  return {title: 'Donation', crumb: 'Donasi dan hibah sosial melalui komite donasi', html: `
    <div class="toolbar">${qSel('don', 'th', q, years.map(y => [y, 'Tahun ' + y]), 'Semua tahun')}${qSel('don', 'dom', q, (ENUM.donasi_domain || []).map(e => [e.kode, e.label]), 'Semua domain')}${qSel('don', 'ring', q, (ENUM.ring || []).map(e => [e.kode, e.label]), 'Semua ring')}${qSel('don', 'st', q, (ENUM.status_donasi || []).map(e => [e.kode, e.label]), 'Semua status')}</div>
    <div class="kpis">${kpi('Proposal', fmt(rows.length), `${fmt(ok.length)} disetujui`) + kpi('Nilai disetujui', rpShort(vOk), 'total proposal disetujui/disalurkan') +
      kpi('Rata-rata per donasi', rpShort(ok.length ? vOk / ok.length : null), 'nilai disetujui') + kpi('Disetujui vs diajukan', pct(vProp ? vOkProp / vProp : null), `dari ${fmt(withProp.length)} proposal yang mencantumkan nilai`) +
      kpi('Nilai ke Ring 1', pct(vOk ? r1 / vOk : null), rpShort(r1)) + kpi('Donasi rutin tahunan', fmt(rows.filter(r => r.kegiatan_tahunan).length), 'ditandai kegiatan tahunan')}</div>
    <div class="grid g2"><div class="card"><h3>Nilai disetujui per kegiatan RIPPM</h3><div class="sub">Kode RIPPM · uraian</div>${hbars(rippm, fv)}</div>
      <div class="card"><h3>Nilai disetujui per lokasi</h3><div class="sub">Sesuai kolom lokasi pada proposal</div>${hbars(lok, fv)}</div></div>
    <div class="grid g2 sect"><div class="card"><h3>Nilai disetujui per domain</h3><div class="sub">Bidang donasi</div>${hbars(domv, fv)}</div>
      <div class="card"><h3>Metode pembayaran</h3><div class="sub">NOI = transfer dana</div>${hbars(met, fv)}</div></div>
    <div class="card sect"><div class="toolbar" style="margin:0 0 10px">${searchBox('Cari kegiatan, kode proyek, atau pengusul…', q.s || '', 'don:s')}<span class="sp"></span><span class="count">${fmt(rows.length)} proposal</span><button class="btn pri" data-new="donasi">${ico('plus')}Donasi</button></div>
      ${genericTable('donasi', rows, ['donasi_id', 'kode_proyek', 'tanggal_komite', 'nama_kegiatan', 'lokasi', 'ring', 'domain', 'nilai_proposal', 'nilai_disetujui', 'metode_pembayaran', 'status'], {del: true})}</div>`};
}

function pInternship(){
  const q = STATE.q.mag || {};
  const all = DB.internship;
  const years = uniq(all.map(r => r.tahun).filter(Boolean)).sort();
  const s = (q.s || '').trim().toLowerCase();
  const rows = all.filter(r => (!q.th || String(r.tahun) === q.th) && (!q.jen || r.jenjang === q.jen) && (!q.dom || r.domisili === q.dom) && (!q.st || r.status === q.st) &&
    (!s || [r.nama, r.institusi, r.jurusan, r.departemen, r.magang_id].some(v => (v || '').toLowerCase().includes(s))))
    .sort((a, b) => (b.tahun || 0) - (a.tahun || 0) || (b.batch || 0) - (a.batch || 0) || (a.nama || '').localeCompare(b.nama || ''));
  const persons = new Set(rows.map(r => normNama(r.nama) + '|' + (r.institusi || '').toLowerCase().slice(0, 12)));
  const fem = rows.filter(r => r.jenis_kelamin === 'perempuan').length, jkKnown = rows.filter(r => r.jenis_kelamin).length;
  const ksb = rows.filter(r => r.domisili === 'ksb').length;
  const done = rows.filter(r => r.status === 'selesai').length;
  const nil = rows.map(r => r.nilai_akhir).filter(v => v != null);
  const yCols = uniq(rows.map(r => r.tahun).filter(Boolean)).sort().map(String);
  const domS = [['ksb', '#E9F40B'], ['ntb_non_ksb', '#403836'], ['non_ntb', '#C7BDBA'], ['luar_negeri', '#8C7B75']].map(([k, c]) => ({n: lbl('domisili_magang', k), c,
    vals: Object.fromEntries(yCols.map(y => [y, rows.filter(r => String(r.tahun) === y && r.domisili === k).length]))}));
  const jen = (ENUM.jenjang_magang || []).map(e => ({l: e.label, v: rows.filter(r => r.jenjang === e.kode).length})).filter(x => x.v);
  const area = topN(countBy(rows, r => r.area_kerja || 'Tidak tercatat'), 8).map(([l, v]) => ({l, v}));
  const inst = topN(countBy(rows, r => r.institusi || 'Tidak tercatat')).map(([l, v]) => ({l, v}));
  fitPage('internship', rows.length);
  return {title: 'Internship', crumb: 'Program magang (PKL dan penelitian) di AMMAN', html: `
    <div class="toolbar">${qSel('mag', 'th', q, years.map(y => [String(y), 'Tahun ' + y]), 'Semua tahun')}${qSel('mag', 'jen', q, (ENUM.jenjang_magang || []).map(e => [e.kode, e.label]), 'Semua jenjang')}${qSel('mag', 'dom', q, (ENUM.domisili_magang || []).map(e => [e.kode, e.label]), 'Semua domisili')}${qSel('mag', 'st', q, (ENUM.status_magang || []).map(e => [e.kode, e.label]), 'Semua status')}</div>
    <div class="kpis">${kpi('Penempatan magang', fmt(rows.length), `${fmt(persons.size)} orang unik`) + kpi('Perempuan', pct(jkKnown ? fem / jkKnown : null), `${fmt(fem)} penempatan`) +
      kpi('Berdomisili di KSB', pct(rows.length ? ksb / rows.length : null), `${fmt(ksb)} penempatan`) + kpi('Selesai', fmt(done), `${fmt(rows.filter(r => r.status === 'berjalan').length)} sedang berjalan`) +
      kpi('Rata-rata nilai akhir', nil.length ? fmt(nil.reduce((a, b) => a + b, 0) / nil.length, 1) : '–', `n = ${fmt(nil.length)}`) + kpi('Sertifikat terbit', fmt(rows.filter(r => r.nomor_sertifikat).length), 'bernomor sertifikat')}</div>
    <div class="grid g2"><div class="card"><h3>Penempatan per tahun dan domisili</h3><div class="sub">Lokal (KSB) dibandingkan luar daerah</div>${yCols.length ? vstack(yCols, domS) : '<div class="empty">Belum ada data</div>'}</div>
      <div class="card"><h3>Jenjang pendidikan</h3><div class="sub">Jumlah penempatan</div>${hbars(jen)}</div></div>
    <div class="grid g2 sect"><div class="card"><h3>Area penempatan</h3><div class="sub">Area kerja di AMMAN</div>${hbars(area)}</div>
      <div class="card"><h3>Institusi asal teratas</h3><div class="sub">10 universitas/sekolah dengan penempatan terbanyak</div>${hbars(inst)}</div></div>
    <div class="card sect"><div class="toolbar" style="margin:0 0 10px">${searchBox('Cari nama, institusi, jurusan, atau departemen…', q.s || '', 'mag:s')}<span class="sp"></span><span class="count">${fmt(rows.length)} penempatan</span><button class="btn pri" data-new="internship">${ico('plus')}Peserta magang</button></div>
      ${genericTable('internship', rows, ['magang_id', 'nama', 'jenis_kelamin', 'institusi', 'jenjang', 'jurusan', 'tahun', 'batch', 'departemen', 'status', 'nilai_akhir'], {del: true})}</div>`};
}

function genericTable(t, rows, cols, opts={}){
  if (!rows.length) return `<div class="empty">Belum ada data. Gunakan tombol <b>Tambah</b> untuk mengisi.</div>`;
  const C = SCHEMA[t].cols.filter(c => cols.includes(c.name)).sort((a,b)=>cols.indexOf(a.name)-cols.indexOf(b.name));
  const page = STATE.page[t] || 0, per = opts.per || 50; const slice = rows.slice(page*per, page*per+per);
  return `<div class="tbl-wrap"><table><thead><tr>${C.map(c => `<th class="${/int|numeric|small/.test(c.typ)?'num':''}">${esc(c.label)}</th>`).join('')}<th></th></tr></thead><tbody>
    ${slice.map(r => `<tr>${C.map(c => `<td class="${/int|numeric|small/.test(c.typ)?'num':''}">${cellView(c, r[c.name])}</td>`).join('')}<td class="act" style="white-space:nowrap"><button class="btn sm" data-edit="${t}" data-id="${esc(keyOf(t,r))}">Ubah</button>${opts.del ? ` <button class="btn icon" data-delask="${t}" data-id="${esc(keyOf(t,r))}" title="Hapus" aria-label="Hapus">${ico('trash')}</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div>${pager(t, rows.length, per)}`;
}
function cellView(c, v){
  if (v == null || v === '') return '<span class="muted">–</span>';
  if (c.enum) return `<span class="pill">${esc(lbl(c.enum, v))}</span>`;
  if (c.typ === 'boolean') return v ? '<span class="pill ok">Ya</span>' : '<span class="pill">Tidak</span>';
  if (c.fk === 'ref_program.program_id') return `<span title="${esc(v)}">${esc(progText(v))}</span>`;
  if (c.fk === 'ref_wilayah.wilayah_id') return esc(wilText(v));
  if (c.fk === 'mitra.mitra_id') return esc((IX.mitra.get(v)||{}).nama_mitra || v);
  if (c.name === 'nik' || c.name === 'no_kk') return `<span class="mask">${esc(maskId(v))}</span>`;
  if (/numeric\(1[46]/.test(c.typ)) return esc(rp(v));
  if (/^(tahun|batch)/.test(c.name)) return esc(String(v));
  if (/numeric|int/.test(c.typ)) return esc(fmt(v, /numeric\((5|3),/.test(c.typ) ? 2 : 0));
  return esc(v);
}
function pager(key, total, per){
  const page = STATE.page[key] || 0; const pages = Math.max(1, Math.ceil(total/per));
  if (pages <= 1) return '';
  return `<div class="pager">${fmt(page*per+1)}–${fmt(Math.min(total,(page+1)*per))} dari ${fmt(total)}
    <button class="btn sm" data-page="${key}:${page-1}" ${page===0?'disabled':''}>‹</button><span>${page+1}/${pages}</span><button class="btn sm" data-page="${key}:${page+1}" ${page>=pages-1?'disabled':''}>›</button></div>`;
}

function pPeserta(){
  const q = STATE.q.peserta || {s:'', pilar:'', prog:'', jk:'', nik:'', ring:''};
  const s = q.s.trim().toLowerCase();
  let rows = DB.peserta.filter(p => {
    if (s && !((p.nama||'').toLowerCase().includes(s) || (p.nik||'').includes(s) || p.peserta_id.toLowerCase().includes(s))) return false;
    if (q.jk && p.jenis_kelamin !== q.jk) return false;
    if (q.nik && p.status_nik !== q.nik) return false;
    if (q.ring && ringOf(p.wilayah_id) !== q.ring) return false;
    if (q.pilar || q.prog) { const es = IX.enrByP.get(p.peserta_id) || []; if (!es.some(e => (!q.pilar || progOf(e.program_id).pilar_kode === q.pilar) && (!q.prog || e.program_id === q.prog))) return false; }
    return true;
  });
  const per = 40, page = STATE.page.peserta || 0;
  const sel = (k, opts, ph) => `<select data-q="peserta:${k}"><option value="">${ph}</option>${opts.map(([v,t]) => `<option value="${esc(v)}" ${q[k]===v?'selected':''}>${esc(t)}</option>`).join('')}</select>`;
  return {title:'Peserta', crumb:'Satu baris = satu orang unik lintas pilar', html:`
    <div class="toolbar">
      ${searchBox('Cari nama, NIK, atau ID…', q.s, 'peserta:s')}
      ${sel('pilar', PILAR.slice(0,3).map(p => [p.k, p.n]), 'Semua pilar')}
      ${sel('prog', DB.ref_program.filter(p => !q.pilar || p.pilar_kode === q.pilar).map(p => [p.program_id, p.program_id + ' · ' + progText(p.program_id)]), 'Semua program')}
      ${sel('jk', (ENUM.jenis_kelamin||[]).map(e => [e.kode, e.label]), 'Jenis kelamin')}
      ${sel('ring', (ENUM.ring||[]).map(e => [e.kode, e.label]), 'Ring')}
      ${sel('nik', (ENUM.status_nik||[]).map(e => [e.kode, e.label]), 'Status NIK')}
      <span class="sp"></span><span class="count">${fmt(rows.length)} peserta</span>
      <button class="btn pri" data-new="peserta">${ico('plus')}Peserta baru</button>
    </div>
    ${SEL.size ? `<div class="note warn toolbar" style="margin-bottom:10px"><b>${fmt(SEL.size)} peserta dipilih</b><span class="sp"></span><button class="btn sm" data-act="selclear">Batal pilih</button><button class="btn sm danger solid" data-act="delsel">${ico('trash')}Hapus terpilih</button></div>` : ''}
    <div class="tbl-wrap"><table><thead><tr><th class="sel"><input type="checkbox" data-selall="${esc(rows.slice(page*per, page*per+per).map(p=>p.peserta_id).join(','))}" title="Pilih semua di halaman ini" ${rows.slice(page*per, page*per+per).every(p => SEL.has(p.peserta_id)) && rows.length ? 'checked' : ''}></th><th>ID</th><th>Nama</th><th>NIK</th><th>JK</th><th>Wilayah</th><th>Ring</th><th>Program diikuti</th><th>Isu</th><th></th></tr></thead><tbody>
      ${rows.slice(page*per, page*per+per).map(p => { const es = IX.enrByP.get(p.peserta_id) || []; const iss = (IX.isuByR.get(p.peserta_id)||[]).filter(i => i.status==='terbuka').length;
        return `<tr class="click ${SEL.has(p.peserta_id)?'picked':''}" data-peserta="${esc(p.peserta_id)}"><td class="sel"><input type="checkbox" data-sel="${esc(p.peserta_id)}" ${SEL.has(p.peserta_id)?'checked':''}></td><td class="id">${esc(p.peserta_id)}</td><td><b>${esc(p.nama || '(nama tidak tercatat)')}</b></td>
        <td><span class="mask">${esc(maskId(p.nik))}</span> ${p.status_nik !== 'valid' && p.status_nik !== 'kosong' ? '<span class="pill bad">' + esc(lbl('status_nik', p.status_nik)) + '</span>' : ''}</td>
        <td>${esc(lbl('jenis_kelamin', p.jenis_kelamin) || '–')}</td><td class="small">${esc(wilText(p.wilayah_id))}</td><td>${ringOf(p.wilayah_id) ? `<span class="pill ${ringOf(p.wilayah_id)==='ring_1'?'lime':''}">${esc(lbl('ring', ringOf(p.wilayah_id)))}</span>` : '–'}</td>
        <td>${es.map(e => `<span class="pill" style="background:${PC[progOf(e.program_id).pilar_kode]};color:${['HCD','CP'].includes(progOf(e.program_id).pilar_kode)?'#fff':'#000'}" title="${esc(progText(e.program_id))}">${esc(e.program_id)}</span>`).join(' ')}</td>
        <td>${iss ? `<span class="pill warn">${iss}</span>` : ''}</td><td class="act"><button class="btn icon" data-delask="peserta" data-id="${esc(p.peserta_id)}" title="Hapus peserta" aria-label="Hapus peserta">${ico('trash')}</button></td></tr>`; }).join('')}
    </tbody></table></div>${pager('peserta', rows.length, per)}`};
}

function pesertaDetail(id){
  const p = IX.peserta.get(id); if (!p) return;
  const es = IX.enrByP.get(id) || []; const rt = IX.rt.get(p.rumah_tangga_id);
  const iss = IX.isuByR.get(id) || [];
  const enrHtml = es.map(e => {
    const b = IX.baseByE.get(e.enrollment_id); const trs = IX.trcByE.get(e.enrollment_id) || []; const pus = IX.puByE.get(e.enrollment_id) || [];
    const pr = progOf(e.program_id);
    return `<div class="card"><div class="toolbar" style="margin:0 0 8px"><span class="pill" style="background:${PC[pr.pilar_kode]};color:${['HCD','CP'].includes(pr.pilar_kode)?'#fff':'#000'}">${esc(pr.pilar_kode)}</span><b>${esc(progText(e.program_id))}</b><span class="sp"></span><button class="btn sm" data-edit="enrollment" data-id="${esc(e.enrollment_id)}">Ubah</button><button class="btn sm danger" data-delask="enrollment" data-id="${esc(e.enrollment_id)}">Hapus</button></div>
      <dl class="kv"><dt>ID keikutsertaan</dt><dd>${esc(e.enrollment_id)} <span class="muted small">(kode lama ${esc(e.kode_lama||'–')})</span></dd>
      <dt>Area PPM</dt><dd>${pr.ppm_area_kode ? esc(pr.ppm_area_kode + '. ' + IX.area.get(pr.ppm_area_kode).nama_kepmen) : '–'}</dd>
      <dt>Mitra · batch</dt><dd>${esc((IX.mitra.get(e.mitra_id)||{}).nama_mitra||'–')} · ${esc(e.batch ?? '–')}</dd>
      <dt>Periode</dt><dd>${esc(e.tahun_mulai ?? '–')} – ${esc(e.tahun_selesai ?? '–')} · ${e.status_partisipasi ? `<span class="pill">${esc(lbl('status_partisipasi', e.status_partisipasi))}</span>` : '–'}</dd>
      ${e.catatan ? `<dt>Catatan</dt><dd>${esc(e.catatan)}</dd>` : ''}</dl>
      ${b ? `<h4 style="margin:14px 0 6px;font-size:12.5px">Baseline</h4><dl class="kv"><dt>Pendidikan</dt><dd>${esc(lbl('pendidikan', b.pendidikan_terakhir)||'–')} ${b.jurusan ? '· ' + esc(b.jurusan) : ''} ${b.institusi_pendidikan ? '· ' + esc(b.institusi_pendidikan) : ''}</dd>
        <dt>Pekerjaan / penghasilan sebelum</dt><dd>${esc(b.pekerjaan_sebelum||'–')} · ${rp(b.penghasilan_bulanan_sebelum)}</dd>
        <dt>Rumah tangga</dt><dd>${esc(b.jumlah_art ?? '–')} ART, ${esc(b.jumlah_art_bekerja ?? '–')} bekerja · ${esc(lbl('kategori_penghasilan_rt', b.kategori_penghasilan_rt)||'–')}</dd></dl>` : ''}
      ${trs.length ? `<h4 style="margin:14px 0 6px;font-size:12.5px">Tracer ketenagakerjaan</h4><div class="tbl-wrap"><table><thead><tr><th>Putaran</th><th>Status</th><th>Jabatan · institusi</th><th class="num">Penghasilan</th><th></th></tr></thead><tbody>${trs.map(t => `<tr><td>${esc(lbl('putaran', t.putaran))}<div class="small muted">${esc(t.tanggal_tracer||'')}</div></td><td>${esc(lbl('status_pekerjaan', t.status_pekerjaan)||'–')} ${IX.unverTracer.has(t.tracer_id) ? '<span class="pill warn">belum terverifikasi</span>' : ''}</td><td>${esc([t.jabatan, t.institusi_kerja].filter(Boolean).join(' · ') || '–')}</td><td class="num">${rp(t.penghasilan_bulanan)}</td><td style="white-space:nowrap"><button class="btn sm" data-edit="tracer_ketenagakerjaan" data-id="${esc(t.tracer_id)}">Ubah</button> <button class="btn sm danger" data-delask="tracer_ketenagakerjaan" data-id="${esc(t.tracer_id)}">Hapus</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      ${pus.map(x => { const u = IX.usaha.get(x.usaha_id); return u ? `<h4 style="margin:14px 0 6px;font-size:12.5px">Usaha</h4><div><a href="javascript:void 0" data-usaha="${esc(u.usaha_id)}"><b>${esc(u.nama_usaha || '(tanpa nama)')}</b></a> · ${esc(lbl('peran_usaha', x.peran_usaha)||'')} · ${esc(lbl('sektor_usaha', u.sektor_usaha)||'')}</div>` : ''; }).join('')}
      <div class="toolbar" style="margin:12px 0 0">
        ${['HCD','ST'].includes(pr.pilar_kode) ? `<button class="btn sm" data-new="tracer_ketenagakerjaan" data-pre='${esc(JSON.stringify({enrollment_id:e.enrollment_id}))}'>+ Tracer</button>${b ? '' : `<button class="btn sm" data-new="baseline_peserta" data-pre='${esc(JSON.stringify({enrollment_id:e.enrollment_id}))}'>+ Baseline</button>`}<button class="btn sm" data-new="sertifikasi" data-pre='${esc(JSON.stringify({enrollment_id:e.enrollment_id}))}'>+ Sertifikasi</button>` : ''}
        ${pr.pilar_kode==='HCD' ? `<button class="btn sm" data-new="pengukuran_kesehatan" data-pre='${esc(JSON.stringify({enrollment_id:e.enrollment_id}))}'>+ Pengukuran kesehatan</button>` : ''}
        ${pr.pilar_kode==='ST' ? `<button class="btn sm" data-new="kontribusi_lingkungan" data-pre='${esc(JSON.stringify({enrollment_id:e.enrollment_id}))}'>+ Kontribusi lingkungan</button>` : ''}
        ${pr.pilar_kode==='EE' ? `<button class="btn sm" data-new="peserta_usaha" data-pre='${esc(JSON.stringify({enrollment_id:e.enrollment_id}))}'>+ Hubungkan usaha</button>` : ''}
      </div></div>`;
  }).join('');
  openDrawer(p.nama || '(nama tidak tercatat)', `
    <div class="toolbar"><span class="pill dark">${esc(p.peserta_id)}</span><span class="pill">${esc(lbl('metode_dedup', p.metode_dedup))}</span><span class="sp"></span>
      <button class="btn sm" data-act="togglenik">${SHOW_NIK ? 'Sembunyikan' : 'Tampilkan'} NIK/KK</button><button class="btn sm dark" data-edit="peserta" data-id="${esc(id)}">Ubah profil</button><button class="btn sm danger" data-delask="peserta" data-id="${esc(id)}">Hapus peserta</button></div>
    <div class="card"><dl class="kv">
      <dt>NIK</dt><dd><span class="mask">${esc(maskId(p.nik))}</span> <span class="pill ${p.status_nik==='valid'?'ok':'bad'}">${esc(lbl('status_nik', p.status_nik))}</span></dd>
      <dt>Tanggal lahir · JK</dt><dd>${esc(p.tanggal_lahir||'–')} · ${esc(lbl('jenis_kelamin', p.jenis_kelamin)||'–')}</dd>
      <dt>Wilayah KTP</dt><dd>${esc(wilText(p.wilayah_id))} ${ringOf(p.wilayah_id) ? `<span class="pill ${ringOf(p.wilayah_id)==='ring_1'?'lime':''}">${esc(lbl('ring', ringOf(p.wilayah_id)))}</span>` : ''}</dd>
      <dt>Alamat domisili</dt><dd>${esc(p.alamat_domisili||'–')}</dd>
      <dt>Kontak</dt><dd>${esc([p.telepon, p.email].filter(Boolean).join(' · ') || '–')}</dd>
      <dt>Disabilitas · rentan</dt><dd>${p.disabilitas ? 'Ya' + (p.jenis_disabilitas ? ' (' + esc(lbl('jenis_disabilitas', p.jenis_disabilitas)) + ')' : '') : p.disabilitas === false ? 'Tidak' : '–'} · ${esc(lbl('kelompok_rentan', p.kelompok_rentan)||'–')}</dd>
      <dt>Consent data (UU PDP)</dt><dd>${p.consent_data ? '<span class="pill ok">Ya</span> ' + esc(p.tanggal_consent||'') : '<span class="pill warn">Belum tercatat</span>'}</dd>
      ${rt ? `<dt>Rumah tangga</dt><dd>${esc(rt.rumah_tangga_id)} · KK <span class="mask">${esc(maskId(rt.no_kk))}</span> · Ayah ${esc(rt.nama_ayah||'–')} · Ibu ${esc(rt.nama_ibu||'–')}</dd>` : ''}
    </dl></div>
    ${iss.length ? `<div class="note warn"><b>Isu data (${iss.length})</b><ul style="margin:6px 0 0 18px;padding:0">${iss.map(i => `<li>${esc(i.jenis_isu.replace(/_/g,' '))}: ${esc(i.tindakan||'')} ${i.status!=='terbuka' ? '<span class="pill ok">' + esc(i.status) + '</span>' : `<button class="btn sm" data-isu="${esc(i.isu_id)}">Tandai selesai</button>`}</li>`).join('')}</ul></div>` : ''}
    <div class="toolbar" style="margin-top:16px"><h3 style="margin:0;font-size:14px">Keikutsertaan program (${es.length})</h3><span class="sp"></span><button class="btn sm pri" data-new="enrollment" data-pre='${esc(JSON.stringify({peserta_id:id}))}'>+ Daftarkan ke program</button></div>
    ${enrHtml}`);
}

function pEnrollment(){
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  const q = STATE.q.enr || (STATE.q.enr = {prog: params.get('program') || '', status:'', s:''});
  if (params.get('program') && q._from !== params.get('program')) { q.prog = params.get('program'); q._from = q.prog; STATE.page.enr = 0; }
  const s = q.s.toLowerCase();
  const rows = enrFiltered().filter(e => (!q.prog || e.program_id === q.prog) && (!q.status || e.status_partisipasi === q.status) &&
      (!s || ((IX.peserta.get(e.peserta_id)||{}).nama||'').toLowerCase().includes(s) || e.enrollment_id.toLowerCase().includes(s)));
  const per = 50, page = STATE.page.enr || 0;
  return {title:'Keikutsertaan Program', crumb:'Satu baris = satu orang dalam satu program/batch', filters:true, html:`
    <div class="toolbar">${searchBox('Cari nama atau ID…', q.s, 'enr:s')}
      <select data-q="enr:prog"><option value="">Semua program</option>${PILAR.map(pl => `<optgroup label="${esc(pl.n)}">${DB.ref_program.filter(p => p.pilar_kode===pl.k).map(p => `<option value="${esc(p.program_id)}" ${q.prog===p.program_id?'selected':''}>${esc(p.program_id + ' · ' + progText(p.program_id))}</option>`).join('')}</optgroup>`).join('')}</select>
      <select data-q="enr:status"><option value="">Semua status</option>${(ENUM.status_partisipasi||[]).map(e => `<option value="${e.kode}" ${q.status===e.kode?'selected':''}>${esc(e.label)}</option>`).join('')}</select>
      <span class="sp"></span><span class="muted small">${fmt(rows.length)} keikutsertaan · ${fmt(uniqP(rows))} orang</span><button class="btn" data-export-view="enr">Ekspor CSV</button></div>
    <div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Peserta</th><th>Program</th><th>Area PPM</th><th>Mitra</th><th class="num">Batch</th><th class="num">Mulai</th><th>Status</th><th>Outcome terakhir</th></tr></thead><tbody>
    ${rows.slice(page*per, page*per+per).map(e => { const p = IX.peserta.get(e.peserta_id)||{}; const pr = progOf(e.program_id); const t = latestTracer(e.enrollment_id);
      const pu = (IX.puByE.get(e.enrollment_id)||[])[0]; const os = pu ? omzetStats(pu.usaha_id) : null;
      return `<tr class="click" data-peserta="${esc(e.peserta_id)}"><td class="id">${esc(e.enrollment_id)}</td><td><b>${esc(p.nama||'–')}</b></td><td class="small">${esc(progText(e.program_id))}</td><td class="small">${esc(pr.ppm_area_kode ? pr.ppm_area_kode + '. ' + IX.area.get(pr.ppm_area_kode).nama_mapping : '–')}</td>
      <td class="small">${esc((IX.mitra.get(e.mitra_id)||{}).nama_mitra||'–')}</td><td class="num">${esc(e.batch ?? '')}</td><td class="num">${esc(e.tahun_mulai ?? '')}</td><td>${e.status_partisipasi ? `<span class="pill">${esc(lbl('status_partisipasi', e.status_partisipasi))}</span>` : ''}</td>
      <td class="small">${t ? esc(lbl('status_pekerjaan', t.status_pekerjaan) || '') + (t.penghasilan_bulanan ? ' · ' + rpShort(t.penghasilan_bulanan) : '') : os && os.n ? 'Omzet ' + rpShort(os.last.omzet) + ' (' + os.n + ' bln)' : '<span class="muted">–</span>'}</td></tr>`; }).join('')}
    </tbody></table></div>${pager('enr', rows.length, per)}`};
}

function pUsaha(){
  const q = STATE.q.usaha || {s:''}; const s = q.s.toLowerCase();
  const rows = DB.usaha.filter(u => !s || (u.nama_usaha||'').toLowerCase().includes(s) || u.usaha_id.toLowerCase().includes(s));
  const per = 40, page = STATE.page.usaha || 0;
  return {title:'Usaha / UMKM', crumb:'Usaha sebagai entitas; omzet & legalitas melekat ke usaha', html:`
    <div class="toolbar">${searchBox('Cari nama usaha…', q.s, 'usaha:s')}<span class="sp"></span><span class="muted small">${fmt(rows.length)} usaha</span><button class="btn pri" data-new="usaha">${ico('plus')}Usaha baru</button></div>
    <div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Nama usaha</th><th>Sektor</th><th>Wilayah</th><th class="num">Peserta</th><th>Legalitas</th><th class="num">Bulan omzet</th><th class="num">Omzet terakhir</th><th>Tren</th></tr></thead><tbody>
    ${rows.slice(page*per, page*per+per).map(u => { const s = omzetStats(u.usaha_id); const lg = (IX.legByU.get(u.usaha_id)||[]).filter(l => l.dimiliki).map(l => l.jenis_legalitas.toUpperCase());
      return `<tr class="click" data-usaha="${esc(u.usaha_id)}"><td class="id">${esc(u.usaha_id)}</td><td><b>${esc(u.nama_usaha||'(tanpa nama)')}</b></td><td>${esc(lbl('sektor_usaha', u.sektor_usaha)||'–')}</td><td class="small">${esc(wilText(u.wilayah_id))}</td>
      <td class="num">${(IX.puByU.get(u.usaha_id)||[]).length}</td><td>${lg.map(x => `<span class="pill ok">${esc(x)}</span>`).join(' ') || '<span class="muted">–</span>'}</td><td class="num">${s.n || '–'}</td><td class="num">${s.n ? rp(s.last.omzet) : '–'}</td><td>${s.n ? spark(s.series) : ''}</td></tr>`; }).join('')}
    </tbody></table></div>${pager('usaha', rows.length, per)}`};
}
function usahaDetail(id){
  const u = IX.usaha.get(id); if (!u) return;
  const o = IX.omzSorted.get(id) || []; const s = omzetStats(id);
  const people = (IX.puByU.get(id)||[]).map(x => { const e = IX.enr.get(x.enrollment_id)||{}; const p = IX.peserta.get(e.peserta_id)||{}; return `<li><a href="javascript:void 0" data-peserta="${esc(p.peserta_id)}">${esc(p.nama||'–')}</a> · ${esc(lbl('peran_usaha', x.peran_usaha)||'')} · ${esc(progText(e.program_id))}</li>`; }).join('');
  const lg = (ENUM.jenis_legalitas||[]).map(j => { const l = (IX.legByU.get(id)||[]).find(x => x.jenis_legalitas === j.kode); return `<span class="pill ${l ? (l.dimiliki ? 'ok' : '') : ''}">${esc(j.label)}: ${l ? (l.dimiliki ? 'Ya' : 'Tidak') : '?'}</span>`; }).join(' ');
  const pm = IX.pmByU.get(id) || [];
  openDrawer(u.nama_usaha || '(tanpa nama)', `
    <div class="toolbar"><span class="pill dark">${esc(id)}</span><span class="pill">${esc(lbl('sektor_usaha', u.sektor_usaha)||'Sektor ?')}</span><span class="sp"></span><button class="btn sm dark" data-edit="usaha" data-id="${esc(id)}">Ubah</button><button class="btn sm danger" data-delask="usaha" data-id="${esc(id)}">Hapus usaha</button></div>
    <div class="kpis">${kpi('Bulan tercatat', fmt(s.n))}${kpi('Omzet rata-rata', rpShort(s.avg))}${kpi('Perubahan', s.chg==null?'–':(s.chg>=0?'+':'')+pct(s.chg), 'awal vs terakhir')}</div>
    <div class="card"><h3>Omzet bulanan</h3><div class="sub">${s.n ? esc(s.first.periode.slice(0,7) + ' → ' + s.last.periode.slice(0,7)) : ''}</div>${lineChart(o.map(x => ({x:x.periode.slice(0,7), y:x.omzet})))}
      <div class="toolbar" style="margin-top:10px"><button class="btn sm pri" data-new="usaha_omzet_bulanan" data-pre='${esc(JSON.stringify({usaha_id:id}))}'>+ Omzet bulan</button></div></div>
    <div class="card"><h3>Legalitas</h3><div class="sub">? = belum diketahui</div>${lg}<div class="toolbar" style="margin-top:10px"><button class="btn sm" data-new="usaha_legalitas" data-pre='${esc(JSON.stringify({usaha_id:id}))}'>+ Legalitas</button><button class="btn sm" data-new="usaha_pemantauan" data-pre='${esc(JSON.stringify({usaha_id:id}))}'>+ Pemantauan</button></div></div>
    ${pm.length ? `<div class="card"><h3>Pemantauan</h3>${pm.map(x => `<div class="small">${esc(lbl('putaran', x.putaran))}: status ${esc(lbl('status_usaha', x.status_usaha)||'–')} · tenaga kerja ${esc(x.tenaga_kerja_total ?? '–')} · e-commerce ${x.menjual_ecommerce==null?'?':x.menjual_ecommerce?'Ya':'Tidak'}</div>`).join('')}</div>` : ''}
    <div class="card"><h3>Peserta terkait</h3><ul style="margin:6px 0 0 18px;padding:0">${people || '<li class="muted">–</li>'}</ul></div>`);
}

function pMitra(){
  const rows = DB.mitra.map(m => { const es = DB.enrollment.filter(e => e.mitra_id === m.mitra_id); return {m, es, n: uniqP(es), progs: uniq(es.map(e => e.program_id)), kontak: DB.mitra_kontak.filter(k => k.mitra_id === m.mitra_id)}; })
    .sort((a,b) => b.es.length - a.es.length);
  return {title:'Mitra Pelaksana', crumb:'Mitra, cakupan program, dan narahubung', html:`
    <div class="toolbar"><span class="muted small">${fmt(rows.length)} mitra · ${fmt(rows.filter(r=>r.es.length).length)} memiliki data peserta</span><span class="sp"></span><button class="btn pri" data-new="mitra">+ Mitra</button><button class="btn" data-new="mitra_kontak">+ Kontak</button></div>
    <div class="tbl-wrap"><table><thead><tr><th>Mitra</th><th class="num">Keikutsertaan</th><th class="num">Orang unik</th><th>Program</th><th>Narahubung</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td><b>${esc(r.m.nama_mitra)}</b><div class="small muted">${esc(r.m.mitra_id)}</div></td><td class="num">${fmt(r.es.length)}</td><td class="num">${fmt(r.n)}</td>
      <td class="small">${r.progs.map(p => `<span class="pill" title="${esc(progText(p))}">${esc(p)}</span>`).join(' ') || '–'}</td>
      <td class="small">${r.kontak.map(k => esc([k.nama_kontak, k.posisi, k.whatsapp, k.email].filter(Boolean).join(' · '))).join('<br>') || '–'}</td>
      <td><button class="btn sm" data-edit="mitra" data-id="${esc(r.m.mitra_id)}">Ubah</button></td></tr>`).join('')}
    </tbody></table></div>`};
}

function pKualitas(){
  const q = STATE.q.isu || {jenis:'', status:'terbuka'};
  const ps = DB.peserta;
  const comp = [['NIK format valid', p => p.status_nik === 'valid'], ['Tanggal lahir', p => p.tanggal_lahir], ['Jenis kelamin', p => p.jenis_kelamin],
    ['Wilayah sampai kecamatan/desa', p => ['kecamatan','desa'].includes(wilOf(p.wilayah_id).level)], ['Wilayah sampai desa', p => wilOf(p.wilayah_id).level === 'desa'],
    ['Nomor telepon', p => p.telepon], ['Status disabilitas tercatat', p => p.disabilitas != null], ['Consent data (UU PDP)', p => p.consent_data === true]]
    .map(([l, f]) => { const n = ps.filter(f).length; return {l, v:n, c: n/ps.length >= .8 ? '#403836' : n/ps.length >= .5 ? '#C7BDBA' : '#E9F40B', txt: pct(n/ps.length)}; });
  const byJ = [...countBy(DB.log_isu_data.filter(i => i.status === 'terbuka'), i => i.jenis_isu)].sort((a,b)=>b[1]-a[1]);
  const rows = DB.log_isu_data.filter(i => (!q.jenis || i.jenis_isu === q.jenis) && (!q.status || i.status === q.status));
  const per = 50, page = STATE.page.isu || 0;
  return {title:'Kualitas Data', crumb:'Kelengkapan field kunci dan log isu migrasi', html:`
    <div class="grid g2"><div class="card"><h3>Kelengkapan data peserta</h3><div class="sub">${fmt(ps.length)} peserta unik · lime = di bawah 50%</div>${hbars(comp, {max: ps.length})}</div>
    <div class="card"><h3>Isu terbuka per jenis</h3><div class="sub">Klik untuk memfilter daftar</div><div class="hb">${byJ.map(([k,v]) => `<div class="l"><a href="javascript:void 0" data-isuj="${esc(k)}">${esc(k.replace(/_/g,' '))}</a></div><div class="t"><span style="width:${v/byJ[0][1]*100}%;background:#403836"></span></div><div class="n">${fmt(v)}</div>`).join('')}</div></div></div>
    <div class="card sect"><div class="toolbar"><h3 style="margin:0">Log isu data</h3><span class="sp"></span>
      <select data-q="isu:jenis"><option value="">Semua jenis</option>${uniq(DB.log_isu_data.map(i=>i.jenis_isu)).sort().map(j => `<option ${q.jenis===j?'selected':''} value="${esc(j)}">${esc(j.replace(/_/g,' '))}</option>`).join('')}</select>
      <select data-q="isu:status"><option value="">Semua status</option>${(ENUM.status_isu||[]).map(s => `<option value="${s.kode}" ${q.status===s.kode?'selected':''}>${esc(s.label)}</option>`).join('')}</select>
      <span class="muted small">${fmt(rows.length)} isu</span><button class="btn" data-export-view="isu">Ekspor CSV</button></div>
    <div class="tbl-wrap"><table><thead><tr><th>ID</th><th>Tabel · record</th><th>Kolom</th><th>Jenis</th><th>Nilai asli</th><th>Tindakan</th><th>Status</th></tr></thead><tbody>
    ${rows.slice(page*per, page*per+per).map(i => `<tr><td class="id">${esc(i.isu_id)}</td><td class="small">${esc(i.tabel)}<br>${i.tabel==='peserta' && IX.peserta.get(i.record_id) ? `<a href="javascript:void 0" data-peserta="${esc(i.record_id)}">${esc(i.record_id)}</a>` : esc(i.record_id||'')}</td><td class="small">${esc(i.kolom||'')}</td>
      <td><span class="pill">${esc(i.jenis_isu.replace(/_/g,' '))}</span></td><td class="small">${esc((i.kolom==='nik'||i.kolom==='no_kk') ? maskId(i.nilai_asli) : (i.nilai_asli||''))}</td><td class="small">${esc(i.tindakan||'')}</td>
      <td>${i.status === 'terbuka' ? `<button class="btn sm" data-isu="${esc(i.isu_id)}">Tandai selesai</button>` : `<span class="pill ok">${esc(lbl('status_isu', i.status))}</span>`}</td></tr>`).join('')}
    </tbody></table></div>${pager('isu', rows.length, per)}</div>`};
}

function pReferensi(){
  const tab = STATE.tab.ref || 'ppm';
  let html = '';
  if (tab === 'ppm') html = `<div class="tbl-wrap"><table><thead><tr><th class="num">No</th><th>Program utama PPM (Kepmen ESDM 1824 K/30/MEM/2018)</th><th>Nomenklatur Program Mapping</th><th>Pilar</th></tr></thead><tbody>${DB.ref_ppm_area.map(a => `<tr><td class="num"><b>${a.ppm_area_kode}</b></td><td>${esc(a.nama_kepmen)}</td><td>${esc(a.nama_mapping)}</td><td>${uniq(DB.ref_program.filter(p=>p.ppm_area_kode===a.ppm_area_kode).map(p=>p.pilar_kode)).map(k => `<span class="pill" style="background:${PC[k]};color:${['HCD','CP'].includes(k)?'#fff':'#000'}">${k}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table></div>`;
  else if (tab === 'program') html = `<div class="toolbar"><span class="sp"></span><button class="btn pri" data-new="ref_program">+ Program / sub-program</button></div>` + genericTable('ref_program', DB.ref_program, ['program_id','pilar_kode','bidang_ppm','ppm_area_kode','program','sub_program','sdgs','aktif'], {per:100});
  else if (tab === 'wilayah') { const q = STATE.q.wil || {s:''}; const rows = DB.ref_wilayah.filter(w => !q.s || (w.nama + ' ' + (w.kecamatan||'') + ' ' + (w.kabupaten||'')).toLowerCase().includes(q.s.toLowerCase()));
    html = `<div class="note warn">Definisi Ring masih asumsi (Ring 1 = Kec. Maluk, Sekongkang, Jereweh; Ring 2 = kecamatan lain di KSB; Ring 3 = luar KSB). Validasi dengan RIPPM, lalu ubah ring per kecamatan/desa. Nama desa belum terverifikasi dan kode Kemendagri belum terisi.</div>
    <div class="toolbar">${searchBox('Cari wilayah…', q.s, 'wil:s')}<span class="sp"></span><button class="btn pri" data-new="ref_wilayah">+ Wilayah</button></div>` + genericTable('ref_wilayah', rows, ['wilayah_id','level','nama','kecamatan','kabupaten','ring','kode_kemendagri','terverifikasi'], {per:60}); }
  else if (tab === 'konversi') html = genericTable('konversi_program_lama', DB.konversi_program_lama, ['konversi_id','nama_mitra_lama','nama_program_lama','program_id','status_mapping','alasan'], {per:100});
  else if (tab === 'kode') html = `<div class="grid g3">${Object.entries(ENUM).map(([k, a]) => `<div class="card"><h3>${esc(k)}</h3><div class="small">${a.map(e => `<div><span class="mask">${esc(e.kode)}</span> — ${esc(e.label)}</div>`).join('')}</div></div>`).join('')}</div>`;
  else if (tab === 'asumsi') html = `<div class="note">Dipakai untuk mengimputasi penghasilan baseline bila peserta belum berpenghasilan (indikator perubahan penghasilan).</div>` + genericTable('asumsi_penghasilan', DB.asumsi_penghasilan, ['pendidikan','upah_bulanan_asumsi','periode_acuan','sumber']);
  return {title:'Referensi', crumb:'Area PPM, program, wilayah & ring, konversi, kode pilihan', html:`
    <div class="tabs">${[['ppm','Area PPM'],['program','Program Mapping'],['wilayah','Wilayah & Ring'],['konversi','Konversi Program Lama'],['asumsi','Asumsi Penghasilan'],['kode','Kode Pilihan']].map(([k,n]) => `<a data-tab="ref:${k}" class="${tab===k?'on':''}">${n}</a>`).join('')}</div>${html}`};
}

function curZoom(){ const v = getComputedStyle(document.documentElement).getPropertyValue('--z').trim(); return String(+v || 0.8); }
function setZoom(v){ document.documentElement.style.setProperty('--z', v); try { localStorage.setItem('ruangdata_zoom', v); } catch(e){} rerender(); toast('Skala tampilan ' + Math.round(v*100) + '%'); }
function pPengaturan(){
  const sizes = Object.keys(SCHEMA).map(t => [t, DB[t].length]);
  return {title:'Impor / Ekspor', crumb:'Sinkronisasi, ekspor, dan privasi', html:`
    <div class="grid g2">
      <div class="card"><h3>Sinkronisasi database</h3><div class="sub">Semua perubahan langsung disimpan ke database (Neon Postgres) dan terlihat oleh pengguna lain setelah memuat ulang. Data dimuat: ${esc(BUILD.tanggal)}.</div>
        <div class="toolbar"><button class="btn pri" data-act="reload">Muat ulang dari server</button><button class="btn" data-act="backup">Unduh salinan lengkap (JSON)</button></div></div>
      <div class="card"><h3>Privasi data (UU 27/2022 PDP)</h3><div class="sub">NIK dan No. KK disamarkan secara default. Aplikasi memuat data pribadi peserta: akses dibatasi sesuai peran, dan salinan yang diunduh harus disimpan di lokasi dengan akses terbatas.</div>
        <label><input type="checkbox" data-act="togglenik" ${SHOW_NIK?'checked':''}> Tampilkan NIK/KK lengkap di sesi ini</label></div>
    </div>
    <div class="card sect"><h3>Skala tampilan</h3><div class="sub">Ukuran tampilan aplikasi di layar desktop (seperti zoom browser). Bawaan 80% agar seluruh halaman muat di layar. Tersimpan di browser ini.</div>
      <div class="toolbar" style="margin:0">${[['0.67','67%'],['0.8','80%'],['0.9','90%'],['1','100%']].map(([v,l]) => `<button class="btn ${String(curZoom())===v?'pri':''}" data-zoom="${v}">${l}</button>`).join('')}</div></div>
    <div class="card sect"><h3>Ekspor per tabel (CSV, siap impor ke PostgreSQL/Neon)</h3><div class="sub">Nama dan urutan kolom sama dengan skema database (schema_social_impact_amman.sql). Impor sesuai urutan di bawah.</div>
      <div class="tbl-wrap"><table><thead><tr><th class="num">#</th><th>Tabel</th><th>Deskripsi</th><th class="num">Baris</th><th></th></tr></thead><tbody>
      ${sizes.map(([t, n], i) => `<tr><td class="num">${i+1}</td><td><span class="mask">${esc(t)}</span></td><td class="small">${esc(SCHEMA[t].desc)}</td><td class="num">${fmt(n)}</td><td><button class="btn sm" data-export="${esc(t)}">CSV</button></td></tr>`).join('')}
      </tbody></table></div><div class="toolbar" style="margin-top:10px"><button class="btn dark" data-act="exportall">Ekspor semua tabel</button></div></div>`};
}

/* ===================== LAPORAN INFOGRAFIS ===================== */
const REP = {jenis:'ringkasan', pilar:'HCD', program:'', dari:'', sampai:'', kab:'', ring:'', judul:'', catatan:'', metodologi:true, narasi:true};
function enrForReport(c){
  return DB.enrollment.filter(e => {
    const p = IX.peserta.get(e.peserta_id) || {}; const pr = progOf(e.program_id);
    if (c.jenis === 'pilar' && pr.pilar_kode !== c.pilar) return false;
    if (c.jenis === 'program' && e.program_id !== c.program) return false;
    if (c.dari && (!e.tahun_mulai || e.tahun_mulai < +c.dari)) return false;
    if (c.sampai && (!e.tahun_mulai || e.tahun_mulai > +c.sampai)) return false;
    if (c.kab && kabOf(p.wilayah_id) !== c.kab) return false;
    if (c.ring && ringOf(p.wilayah_id) !== c.ring) return false;
    return true;
  });
}
const sgn = v => v == null ? '–' : (v >= 0 ? '+' : '') + pct(v);
function repScope(c, S){
  const yrs = S && S.years.length ? S.years : uniq(DB.enrollment.map(e => e.tahun_mulai).filter(Boolean)).sort();
  const a = c.dari || yrs[0], b = c.sampai || yrs[yrs.length-1];
  const per = a == null ? '–' : String(a) === String(b) ? String(a) : `${a}–${b}`;
  const scope = c.jenis === 'ringkasan' ? 'Lintas pilar' : c.jenis === 'pilar' ? (PILAR.find(p => p.k === c.pilar)||{}).n : progText(c.program);
  const wil = [c.kab, c.ring ? lbl('ring', c.ring) : ''].filter(Boolean).join(' · ') || 'Seluruh wilayah';
  return {per, scope, wil};
}
function repStats(c){
  const enrs = enrForReport(c); const d = demo(enrs);
  const byPil = k => enrs.filter(e => progOf(e.program_id).pilar_kode === k);
  const tsAll = tracerStats(enrs.filter(e => ['HCD','ST'].includes(progOf(e.program_id).pilar_kode)));
  const uids = [...new Set(enrs.flatMap(e => (IX.puByE.get(e.enrollment_id)||[]).map(x => x.usaha_id)))];
  const us = uids.map(id => IX.usaha.get(id)).filter(Boolean);
  const os = us.map(u => omzetStats(u.usaha_id)).filter(s => s.n >= 2);
  const area = DB.ref_ppm_area.map(a => { const es = enrs.filter(e => progOf(e.program_id).ppm_area_kode === a.ppm_area_kode);
    return {a, n: uniqP(es), parts: PILAR.map(p => ({c:p.c, v: uniqP(es.filter(e => progOf(e.program_id).pilar_kode === p.k))})).filter(x => x.v)}; });
  const progs = uniq(enrs.map(e => e.program_id)); const mitra = uniq(enrs.map(e => e.mitra_id).filter(Boolean));
  const years = uniq(enrs.map(e => e.tahun_mulai).filter(Boolean)).sort();
  const ps = d.ps; const nikOk = ps.filter(p => p.status_nik === 'valid').length;
  const isu = DB.log_isu_data.filter(i => i.status === 'terbuka' && (IX.peserta.has(i.record_id) ? ps.some(p => p.peserta_id === i.record_id) : false)).length;
  return {enrs, d, byPil, tsAll, us, os, medOmz: median(os.map(s => s.chg)), area, progs, mitra, years, nikOk, isu,
          ring: ['ring_1','ring_2','ring_3'].map(r => ({r, n: ps.filter(p => ringOf(p.wilayah_id) === r).length})),
          ringNA: ps.filter(p => !ringOf(p.wilayah_id)).length,
          kab: [...countBy(ps, p => kabOf(p.wilayah_id) || 'Tidak tercatat')].sort((a,b) => b[1]-a[1])};
}
function repNarrative(c, S){
  const {per} = repScope(c, S); const d = S.d; const L = [];
  if (!d.n) return ['Tidak ada data keikutsertaan untuk cakupan dan periode yang dipilih.'];
  const topA = S.area.filter(a => a.n).sort((x,y) => y.n - x.n)[0];
  const subj = c.jenis === 'ringkasan' ? 'program Social Impact AMMAN' : c.jenis === 'pilar' ? `pilar ${(PILAR.find(p=>p.k===c.pilar)||{}).n}` : `program ${progText(c.program)}`;
  L.push(`Untuk keikutsertaan yang dimulai pada ${per}, ${subj} menjangkau ${fmt(d.n)} penerima manfaat unik melalui ${fmt(S.enrs.length)} keikutsertaan${c.jenis !== 'program' ? ` di ${fmt(S.progs.length)} sub-program` : ''} bersama ${fmt(S.mitra.length)} mitra pelaksana.`);
  const g = []; if (d.femShare != null) g.push(`${pct(d.femShare)} di antaranya perempuan`);
  if (d.n) g.push(`${pct(S.ring[0].n/d.n)} berdomisili di Ring 1`); if (d.dis) g.push(`${fmt(d.dis)} orang tercatat sebagai penyandang disabilitas`);
  if (g.length) { const s = g.length === 1 ? g[0] : g.length === 2 ? g.join(' dan ') : g.slice(0,-1).join(', ') + ', dan ' + g[g.length-1]; L.push(s.charAt(0).toUpperCase() + s.slice(1) + '.'); }
  if (c.jenis === 'ringkasan' && topA) L.push(`Jangkauan terbesar berada pada area PPM ${topA.a.ppm_area_kode} (${topA.a.nama_kepmen.toLowerCase()}) dengan ${fmt(topA.n)} orang.`);
  const ts = c.jenis === 'ringkasan' ? S.tsAll : tracerStats(S.enrs);
  const isEE = (c.jenis === 'pilar' && c.pilar === 'EE') || (c.jenis === 'program' && progOf(c.program).pilar_kode === 'EE');
  if (!isEE && ts.known) L.push(`Dari ${fmt(ts.known)} peserta dengan status pekerjaan tercatat, ${fmt(ts.work)} (${pct(ts.rate)}) telah bekerja${ts.medChg != null ? `; median perubahan penghasilan mereka ${sgn(ts.medChg)} dibanding baseline (n = ${fmt(ts.nChg)})` : ''}.`);
  if ((isEE || c.jenis === 'ringkasan') && S.os.length) L.push(`Sebanyak ${fmt(S.us.length)} usaha dibina; ${fmt(S.os.length)} usaha memiliki catatan omzet minimal dua bulan dengan median perubahan omzet ${sgn(S.medOmz)} (bulan pertama dibanding terakhir tercatat).`);
  return L;
}
function repNotes(c, S){
  const n = [];
  n.push('Penerima manfaat unik dihitung per orang; satu orang yang mengikuti beberapa program dihitung satu kali. Periode mengacu pada tahun mulai keikutsertaan.');
  if (S.d.n && S.nikOk / S.d.n < .9) n.push(`${pct(1 - S.nikOk/S.d.n)} peserta belum memiliki NIK berformat valid, sehingga jumlah orang unik dapat sedikit lebih tinggi dari kenyataan.`);
  if (S.tsAll.unver && F.strict) n.push(`${fmt(S.tsAll.unver)} status bekerja tanpa jabatan, institusi, atau penghasilan dikecualikan dari tingkat bekerja.`);
  n.push('Perubahan penghasilan memakai baseline aktual bila > 0, selain itu upah asumsi BPS menurut pendidikan. Ring wilayah masih berupa asumsi berbasis kecamatan dan perlu divalidasi dengan RIPPM.');
  if (c.catatan) n.push(c.catatan);
  return n;
}

/* ---------- SVG builder ---------- */
function wrapText(txt, maxW, size){
  const cw = size * 0.535; const max = Math.max(8, Math.floor(maxW / cw)); const out = []; let line = '';
  String(txt).split(/\s+/).forEach(w => { if ((line + ' ' + w).trim().length > max) { if (line) out.push(line); line = w; } else line = (line + ' ' + w).trim(); });
  if (line) out.push(line); return out;
}
function buildInfographic(c){
  const S = repStats(c); const sc = repScope(c, S); const W = 1240, M = 64, IW = W - 2*M; let y = 0; const o = [];
  const FONT = 'Inter, Segoe UI, Helvetica Neue, Arial, sans-serif';
  const FONTFACE = cfg.fontFace || '';
  const T = (x, yy, txt, {s=16, w=400, f='#1E1A19', a='start', ls=0, op=1}={}) => o.push(`<text x="${x}" y="${yy}" font-size="${s}" font-weight="${w}" fill="${f}" text-anchor="${a}" letter-spacing="${ls}" opacity="${op}">${esc(txt)}</text>`);
  const R = (x, yy, w, h, f, ex='') => o.push(`<rect x="${x}" y="${yy}" width="${Math.max(0,w)}" height="${h}" fill="${f}" ${ex}/>`);
  const para = (x, yy, txt, maxW, s, lh, opt={}) => { const ls = wrapText(txt, maxW, s); ls.forEach((l,i) => T(x, yy + i*lh, l, {s, ...opt})); return ls.length * lh; };
  const sect = (title, sub) => { y += 56; R(M, y-18, 14, 14, '#E9F40B', 'stroke="#403836" stroke-width="1"'); T(M+26, y-5, title, {s:24, w:700}); if (sub) T(M+26, y+20, sub, {s:14, f:'#7A706C'}); y += sub ? 44 : 22; };
  const isEE = (c.jenis === 'pilar' && c.pilar === 'EE') || (c.jenis === 'program' && progOf(c.program).pilar_kode === 'EE');
  const pc = c.jenis === 'pilar' ? c.pilar : c.jenis === 'program' ? progOf(c.program).pilar_kode : null;
  const logo = cfg.logoData || (document.querySelector('.brand img')||{}).src || '';

  // ---- header
  R(0, 0, W, 260, '#403836');
  o.push(`<image href="${logo}" x="${M}" y="44" width="148" height="56"/>`);
  T(W-M-16, 70, 'Ruang Data', {s:24, w:700, f:'#fff', a:'end', ls:-.4}); R(W-M-9, 58, 9, 9, '#E9F40B', 'rx="2"');
  T(W-M, 94, 'Satu Ruang, Beragam Data', {s:14, f:'#fff', a:'end', op:.65});
  const title = c.judul || (c.jenis === 'ringkasan' ? 'Capaian Social Impact AMMAN' : c.jenis === 'pilar' ? (PILAR.find(p=>p.k===c.pilar)||{}).n : progOf(c.program).program || 'Program');
  const tl = wrapText(title, IW, 44); tl.slice(0,2).forEach((l,i) => T(M, 160 + i*50, l, {s:44, w:700, f:'#fff'}));
  const subY = 160 + (Math.min(tl.length,2)-1)*50 + 40;
  T(M, subY, `${sc.scope !== title ? sc.scope + ' · ' : ''}Periode mulai ${sc.per} · ${sc.wil}`, {s:18, f:'#C7BDBA'});
  const hdrH = Math.max(260, subY + 40); o[0] = `<rect x="0" y="0" width="${W}" height="${hdrH}" fill="#403836"/>`;
  R(0, hdrH, W, 10, '#E9F40B'); y = hdrH + 10;

  // ---- hero tiles
  y += 40; const ts = c.jenis === 'ringkasan' ? S.tsAll : tracerStats(S.enrs);
  const tiles = [
    ['Penerima manfaat unik', fmt(S.d.n), `${fmt(S.enrs.length)} keikutsertaan`],
    ['Perempuan', pct(S.d.femShare), `${fmt(S.d.fem)} orang`],
    ['Ring 1 (lingkar tambang)', pct(S.d.n ? S.ring[0].n/S.d.n : null), `${fmt(S.ring[0].n)} orang`],
    isEE ? ['Usaha dibina', fmt(S.us.length), `${fmt(S.os.length)} dengan omzet ≥ 2 bulan`]
         : ['Tingkat bekerja', pct(ts.rate), ts.known ? `${fmt(ts.work)} dari ${fmt(ts.known)} tracer` : 'belum ada data tracer']];
  const tw = (IW - 3*20) / 4;
  tiles.forEach(([k, v, s], i) => { const x = M + i*(tw+20);
    R(x, y, tw, 150, '#fff', 'stroke="#E5E0DE" rx="12"'); R(x, y+18, 6, 114, '#E9F40B');
    T(x+28, y+40, k, {s:15, f:'#7A706C'}); T(x+28, y+100, v, {s:52, w:700}); T(x+28, y+130, s, {s:14, f:'#7A706C'}); });
  y += 150;

  // ---- narasi
  if (c.narasi) {
    const lines = repNarrative(c, S).join(' '); const h = wrapText(lines, IW - 56, 19).length * 30 + 44;
    y += 28; R(M, y, IW, h, '#F8FBC4', 'rx="12" stroke="#E4EC7A"'); para(M+28, y+38, lines, IW-56, 19, 30, {f:'#1E1A19'}); y += h;
  }

  // ---- jangkauan
  if (c.jenis === 'ringkasan') {
    sect('Jangkauan per program area PPM', 'Penerima manfaat unik · Kepmen ESDM 1824 K/30/MEM/2018 · warna = pilar');
    const mx = Math.max(1, ...S.area.map(a => a.n)); const lw = 470, bw = IW - lw - 90;
    S.area.forEach(a => { const lab = `${a.a.ppm_area_kode}. ${a.a.nama_kepmen}`; T(M, y+19, lab.length > 58 ? lab.slice(0,56) + '…' : lab, {s:15});
      R(M+lw, y+4, bw, 20, '#EDE8E6', 'rx="4"'); let x = M+lw; a.parts.forEach(p => { const w = p.v/mx*bw; R(x, y+4, w, 20, p.c, p.c==='#E9F40B' ? 'stroke="#c9d20a"' : ''); x += w; });
      T(W-M, y+20, a.n ? fmt(a.n) : '0', {s:16, w:700, a:'end', f: a.n ? '#1E1A19' : '#B0A6A2'}); y += 34; });
    y += 6; let lx = M; PILAR.slice(0,3).forEach(p => { R(lx, y, 14, 14, p.c, p.c==='#E9F40B'?'stroke="#c9d20a"':''); T(lx+20, y+12, p.n, {s:13, f:'#7A706C'}); lx += 250; });
    y += 14;
  } else {
    const progs = c.jenis === 'pilar' ? DB.ref_program.filter(p => p.pilar_kode === c.pilar) : [];
    if (progs.length) {
      sect('Jangkauan per sub-program', 'Penerima manfaat unik · sub-program tanpa data ditampilkan abu-abu');
      const rows = progs.map(p => ({l: (p.sub_program ? p.program + ' – ' + p.sub_program : p.program), area: p.ppm_area_kode, n: uniqP(S.enrs.filter(e => e.program_id === p.program_id))}));
      const mx = Math.max(1, ...rows.map(r => r.n)); const lw = 520, bw = IW - lw - 90;
      rows.forEach(r => { T(M, y+19, r.l.length > 62 ? r.l.slice(0,60) + '…' : r.l, {s:15, f: r.n ? '#1E1A19' : '#B0A6A2'});
        R(M+lw, y+4, bw, 20, '#EDE8E6', 'rx="4"'); R(M+lw, y+4, r.n/mx*bw, 20, PC[pc] || '#403836', pc==='EE'?'stroke="#c9d20a"':'');
        T(W-M, y+20, fmt(r.n), {s:16, w:700, a:'end', f: r.n ? '#1E1A19' : '#B0A6A2'}); y += 32; });
    } else {
      sect('Sebaran wilayah', 'Penerima manfaat unik per kabupaten');
      const mx = Math.max(1, ...S.kab.map(k => k[1])); const lw = 300, bw = IW - lw - 90;
      S.kab.slice(0,6).forEach(([l, v]) => { T(M, y+19, l, {s:15}); R(M+lw, y+4, bw, 20, '#EDE8E6', 'rx="4"'); R(M+lw, y+4, v/mx*bw, 20, '#403836'); T(W-M, y+20, fmt(v), {s:16, w:700, a:'end'}); y += 32; });
    }
  }

  // ---- profil: gender pictogram + ring donut
  sect('Profil penerima manfaat', 'Proporsi gender dan Ring wilayah domisili (KTP)');
  const colW = (IW - 40) / 2, top = y;
  R(M, y, colW, 300, '#fff', 'rx="12" stroke="#E5E0DE"'); R(M + colW + 40, y, colW, 300, '#fff', 'rx="12" stroke="#E5E0DE"');
  const tot = S.d.male + S.d.fem; const nf = tot ? Math.round(S.d.fem / tot * 10) : 0;
  for (let i = 0; i < 10; i++) { const x = M + 40 + (i % 5) * 92, yy = y + 40 + Math.floor(i/5) * 110; const f = !tot ? '#E5E0DE' : i < nf ? '#E9F40B' : '#403836';
    o.push(`<circle cx="${x+22}" cy="${yy+16}" r="15" fill="${f}" ${f==='#E9F40B'?'stroke="#a8ae07"':''}/><path d="M${x} ${yy+82} v-28 a22 22 0 0 1 44 0 v28 z" fill="${f}" ${f==='#E9F40B'?'stroke="#a8ae07"':''}/>`); }
  T(M + 40, y + 268, `${pct(S.d.femShare)} perempuan · ${pct(tot ? S.d.male/tot : null)} laki-laki`, {s:18, w:700});
  T(M + colW - 24, y + 268, `n = ${fmt(tot)}`, {s:13, f:'#7A706C', a:'end'});
  // donut
  const cx = M + colW + 40 + 150, cy = y + 150, rr = 100, rw = 34; const rt = S.ring.reduce((s,r)=>s+r.n,0) + S.ringNA; let ang = -Math.PI/2;
  const RC = {ring_1:'#E9F40B', ring_2:'#403836', ring_3:'#C7BDBA', na:'#EDE8E6'};
  const segs = [...S.ring.map(r => ({k:r.r, n:r.n})), {k:'na', n:S.ringNA}].filter(s => s.n);
  if (!rt) o.push(`<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="#EDE8E6" stroke-width="${rw}"/>`);
  segs.forEach(s => { const a2 = ang + s.n/rt * Math.PI*2; const large = a2 - ang > Math.PI ? 1 : 0;
    if (s.n === rt) o.push(`<circle cx="${cx}" cy="${cy}" r="${rr}" fill="none" stroke="${RC[s.k]}" stroke-width="${rw}"/>`);
    else o.push(`<path d="M${cx + rr*Math.cos(ang)} ${cy + rr*Math.sin(ang)} A${rr} ${rr} 0 ${large} 1 ${cx + rr*Math.cos(a2)} ${cy + rr*Math.sin(a2)}" fill="none" stroke="${RC[s.k]}" stroke-width="${rw}"/>`);
    ang = a2; });
  T(cx, cy + 6, pct(S.d.n ? S.ring[0].n/S.d.n : null), {s:30, w:700, a:'middle'}); T(cx, cy + 30, 'Ring 1', {s:13, f:'#7A706C', a:'middle'});
  let ly = y + 70; [...S.ring.map(r => [r.r, lbl('ring', r.r), r.n]), ['na', 'Belum terpetakan', S.ringNA]].forEach(([k, l, n]) => {
    const lx = M + colW + 40 + 300; R(lx, ly-12, 14, 14, RC[k], k==='ring_1'?'stroke="#a8ae07"':''); T(lx + 22, ly, l, {s:15}); T(lx + 22, ly + 22, `${fmt(n)} orang`, {s:14, f:'#7A706C'}); ly += 54; });
  y = top + 300;

  // ---- outcome
  if (c.jenis === 'ringkasan') {
    sect('Capaian per pilar', 'Outcome utama yang tercatat di Ruang Data');
    const cw = (IW - 40) / 3; const cards = PILAR.slice(0,3).map(p => { const es = S.byPil(p.k); const dd = demo(es);
      if (p.k === 'EE') { const ids = [...new Set(es.flatMap(e => (IX.puByE.get(e.enrollment_id)||[]).map(x => x.usaha_id)))]; const ss = ids.map(omzetStats).filter(s => s.n >= 2);
        return {p, kv: [['Penerima manfaat unik', fmt(dd.n)], ['Usaha dibina', fmt(ids.length)], ['Median Δ omzet', sgn(median(ss.map(s => s.chg)))], ['Usaha dengan omzet ≥ 2 bln', fmt(ss.length)]]}; }
      const s = tracerStats(es); return {p, kv: [['Penerima manfaat unik', fmt(dd.n)], ['Tingkat bekerja', pct(s.rate)], ['Median Δ penghasilan', sgn(s.medChg)], ['Rata-rata penghasilan', rpShort(s.avgInc)]]}; });
    cards.forEach((cd, i) => { const x = M + i*(cw+20);
      R(x, y, cw, 270, '#fff', 'rx="12" stroke="#E5E0DE"'); R(x, y, cw, 56, cd.p.c, 'rx="12"'); R(x, y+40, cw, 16, cd.p.c);
      T(x+22, y+36, cd.p.n, {s:17, w:700, f: cd.p.k === 'HCD' ? '#fff' : '#000'});
      cd.kv.forEach(([k, v], j) => { T(x+22, y+92 + j*48, k, {s:13, f:'#7A706C'}); T(x+22, y+116 + j*48, v, {s:22, w:700}); }); });
    y += 270;
  } else if (!isEE) {
    sect('Outcome ketenagakerjaan', 'Status pekerjaan pada tracer terakhir' + (F.strict ? ' · status bekerja tanpa bukti dikecualikan' : ''));
    const kv = [['Tingkat bekerja', pct(ts.rate)], ['Rata-rata penghasilan (bekerja)', rpShort(ts.avgInc)], ['Median Δ penghasilan', sgn(ts.medChg)], ['Tracer tercatat', fmt(ts.known)]];
    const tw2 = (IW - 60) / 4; kv.forEach(([k, v], i) => { const x = M + i*(tw2+20); R(x, y, tw2, 100, '#403836', 'rx="12"'); T(x+22, y+36, k, {s:13, f:'#C7BDBA'}); T(x+22, y+78, v, {s:30, w:700, f:'#E9F40B'}); });
    y += 130; const dist = [...ts.dist].sort((a,b) => b[1]-a[1]); const mx = Math.max(1, ...dist.map(x => x[1])); const lw = 320, bw = IW - lw - 90;
    if (!dist.length) { T(M, y+20, 'Belum ada data tracer untuk cakupan ini.', {s:15, f:'#7A706C'}); y += 30; }
    dist.forEach(([k, v]) => { T(M, y+19, lbl('status_pekerjaan', k), {s:15}); R(M+lw, y+4, bw, 20, '#EDE8E6', 'rx="4"'); R(M+lw, y+4, v/mx*bw, 20, WORK.has(k) ? '#403836' : '#C7BDBA'); T(W-M, y+20, fmt(v), {s:16, w:700, a:'end'}); y += 32; });
  } else {
    sect('Outcome usaha', 'Omzet dan legalitas usaha binaan');
    const nib = S.us.filter(u => (IX.legByU.get(u.usaha_id)||[]).some(l => l.jenis_legalitas === 'nib' && l.dimiliki)).length;
    const kv = [['Usaha dibina', fmt(S.us.length)], ['Omzet ≥ 2 bulan', fmt(S.os.length)], ['Median Δ omzet', sgn(S.medOmz)], ['Usaha ber-NIB', pct(S.us.length ? nib/S.us.length : null)]];
    const tw2 = (IW - 60) / 4; kv.forEach(([k, v], i) => { const x = M + i*(tw2+20); R(x, y, tw2, 100, '#403836', 'rx="12"'); T(x+22, y+36, k, {s:13, f:'#C7BDBA'}); T(x+22, y+78, v, {s:30, w:700, f:'#E9F40B'}); });
    y += 130; const lw = 320, bw = IW - lw - 120;
    (ENUM.jenis_legalitas||[]).forEach(j => { const v = S.us.filter(u => (IX.legByU.get(u.usaha_id)||[]).some(l => l.jenis_legalitas === j.kode && l.dimiliki)).length;
      T(M, y+19, j.label, {s:15}); R(M+lw, y+4, bw, 20, '#EDE8E6', 'rx="4"'); R(M+lw, y+4, S.us.length ? v/S.us.length*bw : 0, 20, '#403836'); T(W-M, y+20, `${fmt(v)} (${pct(S.us.length ? v/S.us.length : null)})`, {s:15, w:700, a:'end'}); y += 32; });
  }

  // ---- tren
  if (S.years.length) {
    sect('Keikutsertaan per tahun mulai', 'Jumlah keikutsertaan program');
    const ch = 200, mx = Math.max(1, ...S.years.map(yr => S.enrs.filter(e => e.tahun_mulai === yr).length)); const bw = Math.min(140, (IW - 40) / S.years.length - 30);
    S.years.forEach((yr, i) => { const x = M + 20 + i * ((IW - 40) / S.years.length) + ((IW - 40) / S.years.length - bw) / 2; let yy = y + ch;
      PILAR.forEach(p => { const v = S.enrs.filter(e => e.tahun_mulai === yr && progOf(e.program_id).pilar_kode === p.k).length; if (!v) return; const h = v/mx*(ch-24); yy -= h; R(x, yy, bw, h, p.c, p.c==='#E9F40B'?'stroke="#c9d20a"':''); });
      const tv = S.enrs.filter(e => e.tahun_mulai === yr).length; T(x + bw/2, yy - 8, fmt(tv), {s:15, w:700, a:'middle'}); T(x + bw/2, y + ch + 24, String(yr), {s:14, f:'#7A706C', a:'middle'}); });
    R(M, y + ch, IW, 1, '#C7BDBA'); y += ch + 40;
  }

  // ---- catatan metodologi & footer
  if (c.metodologi) {
    const notes = repNotes(c, S); y += 30; const lines = notes.map(n => wrapText(n, IW - 70, 14)); const h = lines.reduce((s,l) => s + l.length*21 + 8, 0) + 60;
    R(M, y, IW, h, '#F5F3F2', 'rx="12"'); T(M+28, y+34, 'Catatan metodologi & kualitas data', {s:15, w:700}); let yy = y + 62;
    lines.forEach(ls => { o.push(`<circle cx="${M+33}" cy="${yy-5}" r="3" fill="#403836"/>`); ls.forEach((l, i) => T(M+46, yy + i*21, l, {s:14, f:'#4a413e'})); yy += ls.length*21 + 8; });
    y += h;
  }
  y += 40; R(0, y, W, 70, '#403836'); R(0, y, W, 4, '#E9F40B');
  T(M, y+44, `Sumber: Ruang Data · Social Impact AMMAN · dihasilkan otomatis ${new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}`, {s:13, f:'#fff', op:.8});
  T(W-M, y+44, 'Dokumen internal — data agregat, tanpa data pribadi', {s:13, f:'#E9F40B', a:'end'});
  y += 70;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${y}" width="${W}" height="${y}" font-family="${FONT}"><defs><style>${FONTFACE}</style></defs><rect width="${W}" height="${y}" fill="#FFFFFF"/>${o.join('')}</svg>`;
  return {svg, w: W, h: y, narasi: repNarrative(c, S).join(' ')};
}

function pLaporan(){
  const c = REP; const yrs = uniq(DB.enrollment.map(e => e.tahun_mulai).filter(Boolean)).sort();
  if (!c.program) c.program = (DB.enrollment[0]||{}).program_id || '';
  const kabs = uniq(DB.ref_wilayah.filter(w => w.level === 'kabupaten').map(w => w.nama)).sort();
  const inf = buildInfographic(c); REP._last = inf;
  const opt = (v, t, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
  const progsWithData = DB.ref_program.filter(p => DB.enrollment.some(e => e.program_id === p.program_id));
  return {title:'Laporan Infografis', crumb:'Terisi otomatis dari Ruang Data', html:`
    <div class="grid" style="grid-template-columns:300px minmax(0,1fr);align-items:start">
      <div class="card" style="position:sticky;top:96px">
        <h3>Pengaturan laporan</h3><div class="sub">Angka, grafik, dan narasi dihitung ulang otomatis setiap pengaturan diubah.</div>
        <div class="form" style="grid-template-columns:1fr">
          <div class="f"><label>Jenis laporan</label><select data-rep="jenis">${opt('ringkasan','Ringkasan lintas pilar',c.jenis)}${opt('pilar','Per pilar',c.jenis)}${opt('program','Factsheet per program',c.jenis)}</select></div>
          ${c.jenis === 'pilar' ? `<div class="f"><label>Pilar</label><select data-rep="pilar">${PILAR.slice(0,3).map(p => opt(p.k, p.n, c.pilar)).join('')}</select></div>` : ''}
          ${c.jenis === 'program' ? `<div class="f"><label>Program / sub-program</label><select data-rep="program">${PILAR.map(pl => { const ps = progsWithData.filter(p => p.pilar_kode === pl.k); return ps.length ? `<optgroup label="${esc(pl.n)}">${ps.map(p => opt(p.program_id, p.program_id + ' · ' + progText(p.program_id), c.program)).join('')}</optgroup>` : ''; }).join('')}</select><div class="h">Hanya program yang memiliki data</div></div>` : ''}
          <div class="f"><label>Tahun mulai (dari – sampai)</label><div class="row" style="gap:8px"><select data-rep="dari" style="flex:1"><option value="">Awal</option>${yrs.map(yy => opt(yy, yy, c.dari)).join('')}</select><select data-rep="sampai" style="flex:1"><option value="">Akhir</option>${yrs.map(yy => opt(yy, yy, c.sampai)).join('')}</select></div></div>
          <div class="f"><label>Kabupaten</label><select data-rep="kab"><option value="">Seluruh wilayah</option>${kabs.map(k => opt(k, k, c.kab)).join('')}</select></div>
          <div class="f"><label>Ring</label><select data-rep="ring"><option value="">Semua ring</option>${(ENUM.ring||[]).map(r => opt(r.kode, r.label, c.ring)).join('')}</select></div>
          <div class="f"><label>Judul (opsional)</label><input type="text" data-rep="judul" value="${esc(c.judul)}" placeholder="Otomatis bila kosong"></div>
          <div class="f"><label>Catatan tambahan (opsional)</label><textarea data-rep="catatan" rows="2" placeholder="Muncul di catatan metodologi">${esc(c.catatan)}</textarea></div>
          <div class="f"><label><input type="checkbox" data-rep="narasi" ${c.narasi?'checked':''}> Tampilkan narasi otomatis</label><label><input type="checkbox" data-rep="metodologi" ${c.metodologi?'checked':''}> Tampilkan catatan metodologi</label><label><input type="checkbox" data-act="strict" ${F.strict?'checked':''}> Kecualikan status bekerja tanpa bukti</label></div>
        </div>
        <div class="toolbar" style="margin-top:14px"><button class="btn pri" data-act="rep-png">Unduh PNG</button><button class="btn" data-act="rep-svg">Unduh SVG</button><button class="btn dark" data-act="rep-print">Cetak / PDF</button><button class="btn" data-act="rep-copy">Salin narasi</button></div>
      </div>
      <div><div class="note">Infografis hanya memuat data agregat, tanpa data pribadi. Periode mengacu pada tahun mulai keikutsertaan.</div>
        <div id="rep-preview" style="background:#fff;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;box-shadow:0 8px 30px rgba(64,56,54,.08)">${inf.svg.replace('<svg ', '<svg style="width:100%;height:auto;display:block" ')}</div></div>
    </div>`};
}
function repFileName(ext){ const c = REP; const base = c.jenis === 'ringkasan' ? 'ringkasan' : c.jenis === 'pilar' ? 'pilar_' + c.pilar : 'program_' + c.program; return `RuangData_infografis_${base}_${new Date().toISOString().slice(0,10)}.${ext}`; }
function repPNG(){
  const inf = REP._last || buildInfographic(REP); const scale = 2;
  const img = new Image(); const url = URL.createObjectURL(new Blob([inf.svg], {type:'image/svg+xml;charset=utf-8'}));
  img.onload = () => { const cv = document.createElement('canvas'); cv.width = inf.w * scale; cv.height = inf.h * scale; const ctx = cv.getContext('2d');
    ctx.scale(scale, scale); ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
    try { cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = repFileName('png'); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); toast('PNG diunduh'); }, 'image/png'); }
    catch (e) { toast('Browser menolak ekspor PNG — gunakan Unduh SVG atau Cetak / PDF'); } };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Gagal membuat PNG — gunakan Unduh SVG'); };
  img.src = url;
}
function repPrint(){
  const inf = REP._last || buildInfographic(REP);
  const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(fr);
  fr.srcdoc = `<!DOCTYPE html><html><head><title>${esc(repFileName('pdf'))}</title><style>@page{size:A4;margin:8mm}html,body{margin:0}svg{width:100%;height:auto;display:block}</style></head><body>${inf.svg}</body></html>`;
  fr.onload = () => { setTimeout(() => { fr.contentWindow.focus(); fr.contentWindow.print(); setTimeout(() => fr.remove(), 1500); }, 200); };
}


/* ===================== HAPUS DATA (cascade + undo) ===================== */
const SEL = new Set();
const NO_DEL = new Set(['ref_pilihan','ref_ppm_area','asumsi_penghasilan','log_isu_data']);
const CASCADE = {
  peserta: [['enrollment','peserta_id']],
  enrollment: [['baseline_peserta','enrollment_id'],['tracer_ketenagakerjaan','enrollment_id'],['sertifikasi','enrollment_id'],
               ['pengukuran_kesehatan','enrollment_id'],['kontribusi_lingkungan','enrollment_id'],['peserta_usaha','enrollment_id']],
  usaha: [['peserta_usaha','usaha_id'],['usaha_legalitas','usaha_id'],['usaha_pemantauan','usaha_id'],['usaha_omzet_bulanan','usaha_id']],
  mitra: [['mitra_kontak','mitra_id']],
};
const REFS = {}; Object.entries(SCHEMA).forEach(([tt, def]) => def.cols.forEach(c => { if (c.fk) { const [ft, fc] = c.fk.split('.'); (REFS[ft] = REFS[ft] || []).push([tt, c.name, fc]); } }));
let PLAN = null;
function fkOrder(tables){
  // urutan tabel: induk lebih dulu (dipakai untuk menyisipkan); dibalik untuk menghapus
  const out = [], seen = new Set();
  const deps = tt => SCHEMA[tt].cols.filter(c => c.fk).map(c => c.fk.split('.')[0]).filter(x => x !== tt && tables.has(x));
  const visit = tt => { if (seen.has(tt)) return; seen.add(tt); deps(tt).forEach(visit); out.push(tt); };
  [...tables].forEach(visit); return out;
}
function deletionPlan(targets){
  const items = [], seen = new Set();
  const add = (tt, row) => { const k = tt + '#' + keyOf(tt, row); if (seen.has(k)) return; seen.add(k); items.push([tt, row]);
    (CASCADE[tt] || []).forEach(([ct, col]) => { const id = row[PK[tt][0]]; DB[ct].filter(r => r[col] === id).forEach(r => add(ct, r)); }); };
  targets.forEach(([tt, key]) => { const row = DB[tt].find(r => keyOf(tt, r) === key); if (row) add(tt, row); });
  // rumah tangga yang tidak lagi dipakai peserta lain ikut dihapus
  items.filter(([tt]) => tt === 'peserta').forEach(([, p]) => { if (!p.rumah_tangga_id) return; const rt = IX.rt.get(p.rumah_tangga_id); if (!rt) return;
    const others = DB.peserta.some(o => o.rumah_tangga_id === rt.rumah_tangga_id && !seen.has('peserta#' + keyOf('peserta', o)));
    if (!others) { seen.add('rumah_tangga#' + rt.rumah_tangga_id); items.push(['rumah_tangga', rt]); } });
  // pemblokir: data lain yang masih merujuk & tidak ikut terhapus
  const blockers = [];
  items.forEach(([tt, row]) => (REFS[tt] || []).forEach(([rt, col, fc]) => { if (rt === 'log_isu_data') return;
    DB[rt].forEach(r => { if (r[col] != null && r[col] === row[fc] && !seen.has(rt + '#' + keyOf(rt, r))) blockers.push([rt, r, tt, row]); }); }));
  const ids = new Set(items.map(([tt, r]) => r[PK[tt][0]]));
  const isu = DB.log_isu_data.filter(i => i.status === 'terbuka' && ids.has(i.record_id));
  return {targets, items, blockers, isu};
}
function nameOf(tt, r){
  if (tt === 'peserta') return `${r.nama || '(tanpa nama)'} (${r.peserta_id})`;
  if (tt === 'enrollment') return `${r.enrollment_id} · ${progText(r.program_id)}`;
  if (tt === 'usaha') return `${r.nama_usaha || '(tanpa nama)'} (${r.usaha_id})`;
  if (tt === 'epp_kegiatan' || tt === 'donasi') return `${r.nama_kegiatan || '(tanpa nama)'} (${keyOf(tt, r)})`;
  if (tt === 'internship') return `${r.nama || '(tanpa nama)'} (${r.magang_id})`;
  if (tt === 'mitra') return r.nama_mitra;
  return r[PK[tt][0]];
}
function askDelete(targets){
  const P = deletionPlan(targets); PLAN = P; if (!P.items.length) return;
  const roots = P.items.filter(([tt, r]) => targets.some(([t0, k]) => t0 === tt && keyOf(tt, r) === k));
  const counts = [...countBy(P.items.filter(x => !roots.includes(x)), x => x[0])];
  const bl = [...countBy(P.blockers, b => b[0])];
  const title = roots.length === 1 ? `Hapus ${SCHEMA[roots[0][0]].label.toLowerCase()}?` : `Hapus ${fmt(roots.length)} ${SCHEMA[roots[0][0]].label.toLowerCase()}?`;
  $('#modal').innerHTML = `<div class="mh"><span class="pill bad">Hapus</span>${esc(title)}</div><div class="mb">
    <div>${roots.slice(0, 6).map(([tt, r]) => `<b>${esc(nameOf(tt, r))}</b>`).join('<br>')}${roots.length > 6 ? `<br><span class="muted">… dan ${fmt(roots.length - 6)} lainnya</span>` : ''}</div>
    ${counts.length ? `<div style="margin-top:12px">Data terkait yang ikut terhapus:<ul>${counts.map(([tt, n]) => `<li>${fmt(n)} ${esc(SCHEMA[tt].label.toLowerCase())}</li>`).join('')}</ul></div>` : '<div class="muted" style="margin-top:12px">Tidak ada data terkait lain.</div>'}
    ${P.isu.length ? `<div class="small muted" style="margin-top:8px">${fmt(P.isu.length)} isu data terkait akan ditandai selesai.</div>` : ''}
    ${bl.length ? `<div class="note warn" style="margin-top:12px"><b>Tidak dapat dihapus.</b> Data ini masih dipakai oleh:<ul>${bl.map(([tt, n]) => `<li>${fmt(n)} ${esc(SCHEMA[tt].label.toLowerCase())}</li>`).join('')}</ul>Pindahkan atau hapus data tersebut terlebih dahulu.</div>` :
      `<div class="note" style="margin-top:12px">Penghapusan tercatat di jurnal perubahan dan dapat diurungkan segera setelah dihapus. Untuk data pribadi (UU PDP), pastikan penghapusan sesuai permintaan peserta atau kebijakan retensi data.</div>`}
  </div><div class="mf"><button class="btn" data-mact="cancel">Batal</button><button class="btn danger solid" data-mact="confirm" ${bl.length ? 'disabled' : ''}>Hapus permanen</button></div>`;
  $('#modal').style.display = 'block'; $('#mov').style.display = 'block';
}
function closeModal(){ $('#modal').style.display = 'none'; $('#mov').style.display = 'none'; PLAN = null; }
function doDelete(){
  const P = PLAN; if (!P || P.blockers.length) return;
  const ORD = fkOrder(new Set(P.items.map(x => x[0]))); const rank = tt => ORD.indexOf(tt);
  const parentsFirst = [...P.items].sort((a, b) => rank(a[0]) - rank(b[0]));
  const ops = [...parentsFirst].reverse().map(([tt, row]) => ({t: tt, op: 'del', row}));
  P.isu.forEach(i => ops.push({t: 'log_isu_data', op: 'up', row: {...i, status: 'selesai', tindakan: (i.tindakan || '') + ' [record dihapus]'}}));
  const undo = [...parentsFirst.map(([tt, row]) => ({t: tt, op: 'up', row: {...row}})), ...P.isu.map(i => ({t: 'log_isu_data', op: 'up', row: {...i}}))];
  const rootT = P.targets[0][0]; const n = P.targets.length;
  commitMany(ops); closeModal();
  P.targets.forEach(([tt, k]) => { if (tt === 'peserta') SEL.delete(k); });
  const topLevel = ['peserta', 'usaha'].includes(rootT);
  if (!topLevel && document.getElementById('frm') && REOPEN) { const r = REOPEN; REOPEN = null; r(); }
  else if (!topLevel && DRAWER_CTX && DRAWER_CTX.reopen) DRAWER_CTX.reopen();
  else { REOPEN = null; closeDrawer(); }
  rerender();
  toast(`${n > 1 ? fmt(n) + ' ' : ''}${SCHEMA[rootT].label} dihapus`, {label: 'Urungkan', fn: () => { commitMany(undo); rerender(); if (DRAWER_CTX && DRAWER_CTX.reopen) DRAWER_CTX.reopen(); toast('Penghapusan diurungkan'); }});
}

/* ===================== SARAN ISIAN (klik untuk mengisi) ===================== */
const NO_SUGG = new Set(['nik','no_kk','nama','telepon','email','instagram','facebook','linkedin','sosmed_lain','alamat_domisili','catatan','nama_ayah','nama_ibu','nama_wali',
  'nomor_sertifikat','nomor_izin','latitude','longitude','motivasi','kode_lama','nilai_asli','tindakan','nama_kontak','whatsapp','penghasilan_bulanan','penghasilan_bulanan_sebelum','nilai_investasi','alasan']);
const todayISO = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,10); };
const monthISO = (y, m) => `${y}-${String(m).padStart(2,'0')}-01`;
function nikInfo(n){
  if (!n || !/^\d{16}$/.test(n)) return null;
  let dd = +n.slice(6,8); const mm = +n.slice(8,10), yy = +n.slice(10,12); const fem = dd > 40; if (fem) dd -= 40;
  const cy = new Date().getFullYear() % 100; const yr = (yy > cy ? 1900 : 2000) + yy;
  const dt = new Date(yr, mm - 1, dd); if (dt.getMonth() !== mm - 1 || dd < 1) return {jk: fem ? 'perempuan' : 'laki_laki'};
  return {jk: fem ? 'perempuan' : 'laki_laki', tgl: monthISO(yr, mm).slice(0,8) + String(dd).padStart(2,'0'), prefix: n.slice(0,6)};
}
let NIKKEC = null;
function nikKecMap(){
  if (NIKKEC) return NIKKEC; NIKKEC = new Map();
  DB.peserta.forEach(p => { if (p.status_nik !== 'valid') return; const w = wilOf(p.wilayah_id); const kec = w.level === 'desa' ? w.parent_id : w.level === 'kecamatan' ? w.wilayah_id : null; if (!kec) return;
    const k = p.nik.slice(0,6); if (!NIKKEC.has(k)) NIKKEC.set(k, new Map()); const m = NIKKEC.get(k); m.set(kec, (m.get(kec)||0) + 1); });
  return NIKKEC;
}
function topValues(arr, n = 6, typed = ''){
  const m = new Map(); arr.forEach(v => { if (v == null || v === '') return; const k = String(v); m.set(k, (m.get(k)||0) + 1); });
  const q = String(typed || '').toLowerCase();
  return [...m].filter(([k]) => !q || (k.toLowerCase().includes(q) && k.toLowerCase() !== q)).sort((a,b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}
function suggestions(t, c, V){
  const S = [], add = (v, l, auto) => { if (v == null || v === '' || String(v) === String(V[c.name] ?? '')) return; if (!S.some(x => String(x.v) === String(v))) S.push({v: String(v), l: l ?? String(v), auto}); };
  const n = c.name;
  // ---- otomatis dari NIK
  if (t === 'peserta' && ['tanggal_lahir','jenis_kelamin','wilayah_id'].includes(n)) {
    const ni = nikInfo((V.nik || '').replace(/\s/g,''));
    if (ni) {
      if (n === 'tanggal_lahir' && ni.tgl) add(ni.tgl, 'Dari NIK: ' + ni.tgl, true);
      if (n === 'jenis_kelamin') add(ni.jk, 'Dari NIK: ' + lbl('jenis_kelamin', ni.jk), true);
      if (n === 'wilayah_id') { const m = nikKecMap().get(ni.prefix); if (m) [...m].sort((a,b)=>b[1]-a[1]).slice(0,2).forEach(([id, cnt]) => add(id, `Kode NIK ${ni.prefix}: ${wilText(id)} (${cnt} peserta)`, true)); }
    }
    if (n === 'wilayah_id') topValues(DB.peserta.map(p => p.wilayah_id), 4).forEach(id => add(id, wilText(id)));
    return S;
  }
  if (t === 'rumah_tangga' && n === 'no_kk') return S;
  // ---- keikutsertaan: dari riwayat program
  if (t === 'enrollment') {
    const same = DB.enrollment.filter(e => V.program_id && e.program_id === V.program_id);
    if (n === 'mitra_id') { (same.length ? topValues(same.map(e => e.mitra_id), 5) : topValues(DB.enrollment.map(e => e.mitra_id), 5)).forEach(id => add(id, (IX.mitra.get(id)||{}).nama_mitra || id, !!same.length)); return S; }
    if (n === 'batch') { const pool = same.filter(e => !V.mitra_id || e.mitra_id === V.mitra_id).map(e => e.batch).filter(x => x != null);
      if (pool.length) { const mx = Math.max(...pool); add(mx + 1, `Batch baru: ${mx + 1}`, true); add(mx, `Batch terakhir: ${mx}`); } else add(1, '1'); return S; }
    if (n === 'tahun_mulai') { const y = new Date().getFullYear(); add(y, `Tahun ini (${y})`, true); topValues(same.map(e => e.tahun_mulai), 3).forEach(v => add(v)); return S; }
    if (n === 'tahun_selesai') { const ys = +V.tahun_mulai; if (ys) { const dur = topValues(same.filter(e => e.tahun_mulai && e.tahun_selesai).map(e => e.tahun_selesai - e.tahun_mulai), 2);
      dur.forEach((d, i) => add(ys + +d, `${ys + +d} (durasi umum ${d} th)`, i === 0)); add(ys, `${ys} (selesai tahun yang sama)`); add(ys + 1); } return S; }
    if (n === 'status_partisipasi') { add('terdaftar', 'Terdaftar'); add('berjalan', 'Sedang berjalan'); return S; }
    if (n === 'tingkat_kehadiran') { [[1,'100%'],[0.9,'90%'],[0.8,'80%'],[0.75,'75%']].forEach(([v,l]) => add(v, l)); return S; }
  }
  // ---- omzet: periode berikutnya & nilai bulan lalu
  if (t === 'usaha_omzet_bulanan') {
    const hist = (IX.omzSorted.get(V.usaha_id) || []);
    if (n === 'periode') { const last = hist[hist.length - 1]; if (last) { const d = new Date(last.periode); const nx = new Date(d.getFullYear(), d.getMonth() + 1, 1); add(monthISO(nx.getFullYear(), nx.getMonth() + 1), 'Bulan berikutnya: ' + monthISO(nx.getFullYear(), nx.getMonth() + 1).slice(0,7), true); }
      const now = new Date(); add(monthISO(now.getFullYear(), now.getMonth() + 1), 'Bulan ini'); const pv = new Date(now.getFullYear(), now.getMonth() - 1, 1); add(monthISO(pv.getFullYear(), pv.getMonth() + 1), 'Bulan lalu'); return S; }
    if (n === 'omzet') { const last = hist[hist.length - 1]; if (last) add(last.omzet, 'Sama dengan bulan terakhir: ' + rp(last.omzet)); if (hist.length >= 3) { const a = Math.round(hist.slice(-3).reduce((s,x)=>s+x.omzet,0)/3); add(a, 'Rata-rata 3 bulan: ' + rp(a)); } return S; }
  }
  // ---- baseline: skala nilai otomatis
  if (t === 'baseline_peserta' && n === 'skala_nilai') { const v = +V.nilai_akademik; if (v > 0) add(v <= 4 ? 4 : v <= 10 ? 10 : 100, `Sesuai nilai ${v}: skala ${v <= 4 ? 4 : v <= 10 ? 10 : 100}`, true); [4,10,100].forEach(x => add(x)); return S; }
  if (/tracer|pengukuran|kontribusi/.test(t) && n === 'putaran') { const prev = (IX.trcByE.get(V.enrollment_id) || []).map(x => x.putaran);
    if (!prev.includes('tracer_6bln')) add('tracer_6bln', 'Tracer 6 bulan', true); else if (!prev.includes('tracer_12bln')) add('tracer_12bln', 'Tracer 12 bulan', true); return S; }
  // ---- generik
  if (c.pk) return S;
  if (NO_SUGG.has(n)) {
    if (n === 'alamat_domisili' && V.wilayah_id) add(wilText(V.wilayah_id), 'Sama dengan wilayah KTP: ' + wilText(V.wilayah_id), true);
    if (t === 'peserta' && n === 'nama' && V.nama) { const q = V.nama.trim().toLowerCase(); if (q) DB.peserta.filter(p => (p.nama||'').toLowerCase().startsWith(q) && p.peserta_id !== V.peserta_id).slice(0, 3).forEach(p => S.push({v: p.nama, l: '⚠ Sudah ada: ' + p.nama + ' (' + p.peserta_id + ')'})); }
    return S;
  }
  if (c.enum) {
    const opts = ENUM[c.enum] || [];
    if (opts.length <= 6) opts.forEach(o => add(o.kode, o.label));
    else { topValues(DB[t].map(r => r[n]), 5).forEach(v => add(v, lbl(c.enum, v))); opts.forEach(o => { if (S.length < 6) add(o.kode, o.label); }); }
    if (n === 'kelompok_rentan' && V.disabilitas === 'true') add('lainnya', 'Lainnya');
    return S;
  }
  if (c.typ === 'boolean') {
    if (n === 'consent_data') add('true', 'Ya, sudah memberi persetujuan', false);
    add('true', 'Ya'); add('false', 'Tidak'); return S;
  }
  if (c.typ === 'date') {
    const ev = /^(tanggal_tracer|tanggal_ukur|tanggal_baseline|tanggal_pemantauan|tanggal)$/.test(n) || (n === 'tanggal_consent' && V.consent_data === 'true');
    add(todayISO(), 'Hari ini', ev);
    if (n === 'berlaku_sampai' && V.tanggal_terbit) { const d = new Date(V.tanggal_terbit); d.setFullYear(d.getFullYear() + 3); add(d.toISOString().slice(0,10), '3 tahun dari terbit'); }
    topValues(DB[t].map(r => r[n]), 2).forEach(v => add(v));
    return S;
  }
  if (c.fk === 'ref_wilayah.wilayah_id') { topValues(DB[t].map(r => r[n]).concat(DB.peserta.map(p => p.wilayah_id)), 4).forEach(id => add(id, wilText(id))); return S; }
  if (c.fk === 'mitra.mitra_id') { topValues(DB.enrollment.map(e => e.mitra_id), 4).forEach(id => add(id, (IX.mitra.get(id)||{}).nama_mitra || id)); return S; }
  if (c.fk === 'ref_program.program_id') { if (t === 'lembaga_komunitas' || t === 'infrastruktur') { const id = t === 'lembaga_komunitas' ? 'CP-CI-01' : 'CP-IN-01'; add(id, id + ' · ' + progText(id), true); } topValues(DB[t].map(r => r[n]).concat(DB.enrollment.map(e => e.program_id)), 4).forEach(id => add(id, id + ' · ' + progText(id))); return S; }
  if (c.fk === 'rumah_tangga.rumah_tangga_id') return S;
  if (c.fk && BIG_FK.has(c.fk)) {
    const [ft] = c.fk.split('.'); const pk = PK[ft][0];
    DB[ft].slice(-3).reverse().forEach(r => add(r[pk], ft === 'peserta' ? (r.nama || r[pk]) + ' (' + r[pk] + ')' : ft === 'enrollment' ? ((IX.peserta.get(r.peserta_id)||{}).nama || '') + ' · ' + r.program_id : r[pk]));
    return S;
  }
  if (c.fk === 'ref_program.program_id' && (t === 'lembaga_komunitas' || t === 'infrastruktur')) { const id = t === 'lembaga_komunitas' ? 'CP-CI-01' : 'CP-IN-01'; add(id, id + ' · ' + progText(id), true); }
  if (c.fk) { const [ft] = c.fk.split('.'); const pk = PK[ft][0]; topValues(DB[t].map(r => r[n]), 4).forEach(v => { const r = DB[ft].find(x => String(x[pk]) === v); add(v, r ? (r.nama_usaha || r.nama_lembaga || r.nama_mitra || r.nama_mapping || v) : v); }); return S; }
  if (/^tahun/.test(n)) add(new Date().getFullYear(), 'Tahun ini (' + new Date().getFullYear() + ')');
  if (/int|numeric/.test(c.typ)) { topValues(DB[t].map(r => r[n]), 5).forEach(v => add(v, fmt(+v, /numeric\((3|5),/.test(c.typ) ? 2 : 0))); return S; }
  topValues(DB[t].map(r => r[n]), 6, V[n]).forEach(v => add(v, v.length > 40 ? v.slice(0, 38) + '…' : v));
  return S;
}
function formValues(frm){ const V = {}; [...frm.elements].forEach(el => { if (el.name) V[el.name] = el.value; }); const pre = JSON.parse(frm.dataset.pre || '{}'); Object.entries(pre).forEach(([k, v]) => { if (V[k] == null || V[k] === '') V[k] = v; }); return V; }
function updateSugg(){
  const frm = document.getElementById('frm'); if (!frm) return; const t = frm.dataset.t; const V = formValues(frm);
  frm.querySelectorAll('[data-sugg]').forEach(box => {
    const c = SCHEMA[t].cols.find(x => x.name === box.dataset.sugg); const el = frm.elements[c.name];
    if (!el || el.disabled || el.readOnly) { if (box.dataset.h) { box.dataset.h = ''; box.innerHTML = ''; } return; }
    const S = suggestions(t, c, V);
    const html = S.length ? `<span class="sl">Saran:</span>` + S.map(s => `<button type="button" class="chip ${s.auto ? 'auto' : ''}" data-fill="${esc(c.name)}" data-val="${esc(s.v)}" title="Klik untuk mengisi">${esc(s.l)}</button>`).join('') : '';
    if (box.dataset.h !== html) { box.dataset.h = html; box.innerHTML = html; }
  });
}
function autoFill(){
  const frm = document.getElementById('frm'); if (!frm) return; const t = frm.dataset.t; let n = 0;
  for (let pass = 0; pass < 4; pass++) {
    let changed = 0; const V = formValues(frm);
    SCHEMA[t].cols.forEach(c => {
      const el = frm.elements[c.name]; if (!el || el.disabled || el.readOnly || (el.value || '').trim() !== '') return;
      const s = suggestions(t, c, V).find(x => x.auto && !String(x.l).startsWith('⚠'));
      if (!s) return; if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === s.v)) return;
      el.value = s.v; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); V[c.name] = s.v; changed++; n++;
    });
    if (!changed) break;
  }
  updateSugg(); toast(n ? `${n} kolom diisi otomatis — periksa kembali sebelum menyimpan` : 'Tidak ada saran utama untuk kolom yang masih kosong');
}
function fillField(name, val){
  const frm = document.getElementById('frm'); if (!frm) return; const el = frm.elements[name]; if (!el) return;
  if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === val)) { toast('Pilihan tidak tersedia'); return; }
  el.value = val; el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  el.dispatchEvent(new Event('input', {bubbles: true})); updateSugg();
}

/* ===================== drawer & forms ===================== */
function openDrawer(title, html){ $('#dtitle').textContent = title; $('#dbody').innerHTML = html; $('#drawer').classList.add('show'); $('#ov').classList.add('show'); $('#dbody').scrollTop = 0; DRAWER_CTX = {title, html}; }
function closeDrawer(){ $('#drawer').classList.remove('show'); $('#ov').classList.remove('show'); DRAWER_CTX = null; }
let DRAWER_CTX = null, REOPEN = null;
const HIDE = {peserta:['status_nik','metode_dedup'], rumah_tangga:['status_no_kk'], enrollment:['konversi_id','kode_lama'], log_isu_data:[]};
const BIG_FK = new Set(['peserta.peserta_id','enrollment.enrollment_id','rumah_tangga.rumah_tangga_id']);
function fkOptions(fk, cur){
  const [t] = fk.split('.');
  if (t === 'ref_program') return PILAR.map(pl => `<optgroup label="${esc(pl.n)}">${DB.ref_program.filter(p=>p.pilar_kode===pl.k).map(p => `<option value="${esc(p.program_id)}" ${cur===p.program_id?'selected':''}>${esc(p.program_id + ' · ' + progText(p.program_id) + (p.ppm_area_kode ? ' [PPM ' + p.ppm_area_kode + ']' : ''))}</option>`).join('')}</optgroup>`).join('');
  if (t === 'ref_wilayah') return ['kabupaten','kecamatan','desa'].map(l => `<optgroup label="${l}">${DB.ref_wilayah.filter(w=>w.level===l).sort((a,b)=>wilText(a.wilayah_id).localeCompare(wilText(b.wilayah_id))).map(w => `<option value="${esc(w.wilayah_id)}" ${cur===w.wilayah_id?'selected':''}>${esc(wilText(w.wilayah_id))}</option>`).join('')}</optgroup>`).join('');
  if (t === 'ref_ppm_area') return DB.ref_ppm_area.map(a => `<option value="${a.ppm_area_kode}" ${String(cur)===String(a.ppm_area_kode)?'selected':''}>${a.ppm_area_kode}. ${esc(a.nama_mapping)}</option>`).join('');
  const pk = PK[t][0]; const nameCol = {mitra:'nama_mitra', usaha:'nama_usaha', lembaga_komunitas:'nama_lembaga', konversi_program_lama:'nama_program_lama', epp_kegiatan:'nama_kegiatan', donasi:'nama_kegiatan', internship:'nama'}[t];
  return DB[t].map(r => `<option value="${esc(r[pk])}" ${cur===r[pk]?'selected':''}>${esc(r[pk] + (nameCol && r[nameCol] ? ' · ' + r[nameCol] : ''))}</option>`).join('');
}
function bigFkList(fk){
  const [t] = fk.split('.');
  if (t === 'peserta') return DB.peserta.map(p => `<option value="${esc(p.peserta_id)}">${esc((p.nama||'') + ' · ' + maskId(p.nik))}</option>`).join('');
  if (t === 'enrollment') return DB.enrollment.map(e => `<option value="${esc(e.enrollment_id)}">${esc(((IX.peserta.get(e.peserta_id)||{}).nama||'') + ' · ' + e.program_id)}</option>`).join('');
  return DB[t].map(r => `<option value="${esc(r[PK[t][0]])}"></option>`).join('');
}
function openForm(t, row, isNew, pre={}){
  const def = SCHEMA[t]; const r = isNew ? {...pre} : {...row};
  if (isNew) { const pk = PK[t]; if (pk.length === 1 && !/kategori|pendidikan|ppm_area_kode/.test(pk[0])) r[pk[0]] = nextId(t); }
  if (isNew && t === 'enrollment') r.status_partisipasi = r.status_partisipasi || 'terdaftar';
  if (isNew && /tracer|pengukuran/.test(t)) r.putaran = r.putaran || 'tracer_6bln';
  if (isNew && t === 'usaha_omzet_bulanan') { const d = new Date(); r.periode = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10); }
  const hidden = HIDE[t] || [];
  const fields = def.cols.filter(c => !hidden.includes(c.name)).map(c => {
    const v = r[c.name]; const lock = (c.pk && !isNew) || (c.pk && PK[t].length===1 && isNew && !/kategori|pendidikan|ppm_area_kode/.test(c.name)) || (pre[c.name] != null && c.fk);
    const id = 'f_' + c.name; let input;
    if (c.enum) input = `<select id="${id}" name="${c.name}" ${lock?'disabled':''}><option value=""></option>${(ENUM[c.enum]||[]).map(e => `<option value="${esc(e.kode)}" ${v===e.kode?'selected':''}>${esc(e.label)}</option>`).join('')}</select>`;
    else if (c.typ === 'boolean') input = `<select id="${id}" name="${c.name}" ${lock?'disabled':''}><option value="">Belum diketahui</option><option value="true" ${v===true?'selected':''}>Ya</option><option value="false" ${v===false?'selected':''}>Tidak</option></select>`;
    else if (c.fk && BIG_FK.has(c.fk)) input = `<input id="${id}" name="${c.name}" list="dl_${c.name}" value="${esc(v??'')}" ${lock?'readonly':''} placeholder="Ketik nama/ID…"><datalist id="dl_${c.name}">${lock ? '' : bigFkList(c.fk)}</datalist>`;
    else if (c.fk) input = `<select id="${id}" name="${c.name}" ${lock?'disabled':''}><option value=""></option>${fkOptions(c.fk, v)}</select>`;
    else if (c.typ === 'date') input = `<input type="date" id="${id}" name="${c.name}" value="${esc(v??'')}" ${lock?'readonly':''}>`;
    else if (/int|numeric/.test(c.typ)) input = `<input type="number" step="any" id="${id}" name="${c.name}" value="${esc(v??'')}" ${lock?'readonly':''}>`;
    else if (/catatan|alasan|motivasi|desc|tindakan|alamat/.test(c.name)) input = `<textarea id="${id}" name="${c.name}" rows="2">${esc(v??'')}</textarea>`;
    else input = `<input type="text" id="${id}" name="${c.name}" value="${esc(c.name==='nik'||c.name==='no_kk' ? (v??'') : (v??''))}" ${lock?'readonly':''} ${c.name==='nik'||c.name==='no_kk'?'inputmode="numeric" maxlength="16" autocomplete="off"':''}>`;
    const full = /catatan|alasan|motivasi|alamat|program_id|wilayah_id|nama_kepmen|sumber|tindakan/.test(c.name);
    return `<div class="f ${full?'full':''}"><label for="${id}">${esc(c.label)} ${c.req?'<span class="rq">*</span>':''}</label>${input}<div class="sugg" data-sugg="${c.name}"></div><div class="h">${esc(c.desc||'')}</div><div class="err" data-err="${c.name}"></div></div>`;
  }).join('');
  REOPEN = DRAWER_CTX && DRAWER_CTX.reopen ? DRAWER_CTX.reopen : null;
  const riw = t === 'enrollment' && r.peserta_id ? (IX.enrByP.get(r.peserta_id) || []).filter(e => e.enrollment_id !== r.enrollment_id) : [];
  const riwHtml = t === 'enrollment' && r.peserta_id ? `<div class="note"><b>${esc((IX.peserta.get(r.peserta_id) || {}).nama || r.peserta_id)}</b> · riwayat keikutsertaan: ${riw.length ? riw.map(e => `${esc(e.program_id)}${e.batch ? ' batch ' + esc(e.batch) : ''}${e.tahun_mulai ? ' (' + e.tahun_mulai + ')' : ''}`).join('; ') : 'belum ada'}. Program, batch & tahun yang sama tidak bisa didaftarkan dua kali.</div>` : '';
  openDrawer((isNew ? 'Tambah ' : 'Ubah ') + def.label, `<div class="note">${esc(def.desc)}</div>${riwHtml}<div class="toolbar"><button type="button" class="btn sm pri" data-act="autofill">${ico('plus')}Isi otomatis dari saran</button><span class="muted small">Mengisi kolom kosong dengan saran utama (penanda lime). Klik saran mana pun di bawah kolom untuk mengisinya.</span></div><form class="form" id="frm" data-t="${t}" data-isnew="${isNew?1:0}" data-orig='${esc(JSON.stringify(isNew ? {} : row))}' data-pre='${esc(JSON.stringify(pre))}'>${fields}
    <div class="actions">${!isNew && !NO_DEL.has(t) ? `<button type="button" class="btn danger" data-delask="${t}" data-id="${esc(keyOf(t,row))}" style="margin-right:auto">Hapus</button>` : ''}<button type="button" class="btn" data-act="close">Batal</button><button type="submit" class="btn pri">Simpan</button></div></form>`);
  updateSugg();
}
/* ===================== deteksi data ganda ===================== */
const GELAR_RE = /\b(hj?|ir|dr|drs|dra|prof|s\.?\s?(pd|e|t|h|kom|sos|ag|ip|kep|km|si|ak|psi)|a\.?\s?md|m\.?\s?(pd|si|m|t|h|kes)|st|se|sh|spd)\b\.?/g;
function normNama(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(GELAR_RE,' ').replace(/[^a-z\s]/g,' ').replace(/\s+/g,' ').trim(); }
function simNama(a, b){
  a = normNama(a); b = normNama(b); if (!a || !b) return 0; if (a === b) return 1;
  const g = s => { s = ' ' + s + ' '; const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = g(a), B = g(b); let inter = 0, tot = 0; A.forEach((v, k) => { inter += Math.min(v, B.get(k) || 0); tot += v; }); B.forEach(v => tot += v);
  return 2 * inter / tot;
}
/** Peserta lain yang kemungkinan orang yang sama (peringatan, bukan penolakan). */
function kandidatGanda(row){
  const nik = (row.nik || '').replace(/\s/g, ''), out = [];
  if (!row.nama) return out;
  for (const p of DB.peserta) {
    if (p.peserta_id === row.peserta_id) continue;
    const s = simNama(p.nama, row.nama); let alasan = null;
    if (nik.length >= 12 && p.nik && p.nik.slice(0, 12) === nik.slice(0, 12) && s >= 0.6) alasan = 'Kode wilayah & tanggal lahir dalam NIK sama, nama mirip';
    else if (row.tanggal_lahir && p.tanggal_lahir === row.tanggal_lahir && s >= 0.75) alasan = 'Tanggal lahir sama, nama mirip';
    else if ((!row.tanggal_lahir || !p.tanggal_lahir) && s >= 0.92 && row.wilayah_id && p.wilayah_id === row.wilayah_id) alasan = 'Nama hampir sama di wilayah yang sama (tanggal lahir tidak lengkap)';
    if (alasan) out.push({p, s, alasan});
  }
  return out.sort((a, b) => b.s - a.s).slice(0, 5);
}
function tampilKandidat(frm, list){
  let box = frm.querySelector('#dupwarn');
  if (!box) { box = document.createElement('div'); box.id = 'dupwarn'; box.className = 'dupwarn full'; frm.prepend(box); }
  box.innerHTML = `<div class="dwh">${ico('alert')}<b>Kemungkinan peserta ini sudah terdaftar</b></div>
    <p>Bila orangnya sama, <b>jangan buat peserta baru</b>. Pilih <b>Gunakan peserta ini</b> untuk menambahkan keikutsertaan (kegiatan) baru pada data yang sudah ada.</p>
    ${list.map(({p, s, alasan}) => { const n = (IX.enrByP.get(p.peserta_id) || []).length; return `<div class="dc"><div><b>${esc(p.nama || '–')}</b> <span class="muted small">${esc(p.peserta_id)}</span>
      <div class="small muted">${esc(p.tanggal_lahir ? new Date(p.tanggal_lahir + 'T00:00:00').toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'}) : 'Tgl lahir –')} · ${esc(wilText(p.wilayah_id))} · NIK ${esc(maskId(p.nik) || '–')} · ${fmt(n)} keikutsertaan</div>
      <div class="small"><span class="pill warn">${esc(alasan)}</span> <span class="muted">kemiripan nama ${Math.round(s * 100)}%</span></div></div>
      <button type="button" class="btn sm pri" data-usep="${esc(p.peserta_id)}">Gunakan peserta ini</button></div>`; }).join('')}
    <div class="df"><button type="button" class="btn sm" data-act="dupok">Ini orang berbeda, tetap simpan sebagai peserta baru</button></div>`;
  box.scrollIntoView({block: 'start', behavior: 'smooth'});
}
function enrollmentGanda(row, orig){
  if (!row.peserta_id || !row.program_id) return null;
  const k = e => [e.peserta_id, e.program_id, String(e.batch ?? '').trim().toLowerCase(), e.tahun_mulai ?? ''].join('|');
  const kr = k(row);
  if (orig && orig.enrollment_id && k(orig) === kr) return null; // kombinasi tidak berubah (data lama boleh disimpan)
  return DB.enrollment.find(e => e.enrollment_id !== row.enrollment_id && k(e) === kr) || null;
}

function readForm(frm){
  const t = frm.dataset.t; const def = SCHEMA[t]; const isNew = frm.dataset.isnew === '1';
  const orig = JSON.parse(frm.dataset.orig || '{}'); const pre = JSON.parse(frm.dataset.pre || '{}');
  const row = {...orig, ...pre}; const errs = {};
  def.cols.forEach(c => {
    const el = frm.elements[c.name]; if (!el) return;
    let v = el.value.trim();
    if (v === '') v = null;
    else if (c.typ === 'boolean') v = v === 'true';
    else if (/int|smallint/.test(c.typ) || c.name === 'ppm_area_kode') { v = Number(v); if (!Number.isInteger(v)) errs[c.name] = 'Harus bilangan bulat'; }
    else if (/numeric/.test(c.typ)) { v = Number(v); if (isNaN(v)) errs[c.name] = 'Harus angka'; }
    if (c.fk && v != null && c.fk !== 'ref_ppm_area.ppm_area_kode') { const [ft, fc] = c.fk.split('.'); if (!DB[ft].some(r => r[fc] === v)) errs[c.name] = 'Tidak ditemukan di ' + ft; }
    if (c.enum && v != null && !(ENUM[c.enum]||[]).some(e => e.kode === v)) errs[c.name] = 'Kode tidak valid';
    row[c.name] = v;
  });
  def.cols.forEach(c => { if (c.req && (row[c.name] == null || row[c.name] === '') && !(HIDE[t]||[]).includes(c.name)) errs[c.name] = 'Wajib diisi'; });
  // aturan khusus
  if (t === 'peserta') {
    const n = row.nik ? row.nik.replace(/\s/g,'') : null; row.nik = n;
    row.status_nik = !n ? 'kosong' : !/^\d+$/.test(n) ? 'non_digit' : n.length !== 16 ? 'panjang_salah' : n.endsWith('0000') ? 'rusak_0000' : 'valid';
    if (n && row.status_nik !== 'valid') errs.nik = 'NIK harus 16 digit angka dan tidak berakhiran 0000 (status: ' + lbl('status_nik', row.status_nik) + ')';
    const dup = row.status_nik === 'valid' && DB.peserta.find(p => p.nik === n && p.peserta_id !== row.peserta_id);
    if (dup) errs.nik = `NIK sudah terdaftar atas ${dup.nama} (${dup.peserta_id}). Tambahkan keikutsertaan pada peserta tersebut.`;
    row.metode_dedup = row.metode_dedup || 'tunggal';
    if (row.disabilitas !== true) row.jenis_disabilitas = row.jenis_disabilitas && row.disabilitas === true ? row.jenis_disabilitas : (row.disabilitas === true ? row.jenis_disabilitas : null);
  }
  if (t === 'rumah_tangga') { const n = row.no_kk; row.status_no_kk = !n ? 'kosong' : !/^\d+$/.test(n) ? 'non_digit' : n.length !== 16 ? 'panjang_salah' : n.endsWith('0000') ? 'rusak_0000' : 'valid'; }
  if (t === 'usaha_omzet_bulanan' && row.periode) { row.periode = row.periode.slice(0,8) + '01'; const dup = DB.usaha_omzet_bulanan.find(o => o.usaha_id === row.usaha_id && o.periode === row.periode && o.omzet_id !== row.omzet_id); if (dup) errs.periode = 'Omzet bulan ini sudah tercatat (' + dup.omzet_id + ')'; }
  if (t === 'baseline_peserta' && isNew && IX.baseByE.has(row.enrollment_id)) errs.enrollment_id = 'Baseline untuk keikutsertaan ini sudah ada';
  if (t === 'baseline_peserta' && row.nilai_akademik != null && (row.skala_nilai == null || row.nilai_akademik > row.skala_nilai)) errs.skala_nilai = 'Isi skala (4/10/100) dan pastikan nilai ≤ skala';
  if (t === 'enrollment' && row.tingkat_kehadiran != null && (row.tingkat_kehadiran < 0 || row.tingkat_kehadiran > 1)) errs.tingkat_kehadiran = 'Isi proporsi 0–1 (mis. 0,85)';
  if (t === 'enrollment' && row.tahun_mulai && row.tahun_selesai && row.tahun_selesai < row.tahun_mulai) errs.tahun_selesai = 'Tahun selesai sebelum tahun mulai';
  if (t === 'enrollment') { const dup = enrollmentGanda(row, isNew ? null : orig); if (dup) errs.program_id = `Peserta ini sudah terdaftar di program yang sama dengan batch & tahun mulai yang sama (${dup.enrollment_id}${dup.batch ? ', batch ' + dup.batch : ''}${dup.tahun_mulai ? ', ' + dup.tahun_mulai : ''}). Ubah keikutsertaan tersebut, atau isi batch/tahun yang berbeda bila memang mengikuti ulang.`; }
  if (isNew) { const k = keyOf(t, row); if (DB[t].some(r => keyOf(t, r) === k)) errs[PK[t][0]] = 'ID sudah dipakai'; }
  return {t, row, errs};
}

/* ===================== export ===================== */
function csvOf(t, rows){
  const cols = SCHEMA[t].cols.map(c => c.name);
  const cell = v => v == null ? '' : typeof v === 'boolean' ? (v ? 'true' : 'false') : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g,'""') + '"' : String(v);
  return '﻿' + [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
}
function download(name, text, type='text/csv'){
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ===================== events ===================== */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-usep],[data-zoom],[data-uact],[data-fill],[data-sel],[data-selall],[data-delask],[data-mact],[data-act],[data-new],[data-edit],[data-peserta],[data-usaha],[data-page],[data-tab],[data-export],[data-export-view],[data-isu],[data-isuj],[data-go],[data-del]');
  if (!el) { if (ev.target.id === 'ov') closeDrawer(); return; }
  const d = el.dataset;
  if (d.usep) { const id = d.usep; const fn = () => { pesertaDetail(id); DRAWER_CTX.reopen = fn; }; fn(); openForm('enrollment', null, true, {peserta_id: id}); REOPEN = fn; toast('Peserta lama dipakai. Lengkapi keikutsertaan (kegiatan) barunya.'); return; }
  if (d.act === 'dupok') { const f = document.getElementById('frm'); if (f) { f.dataset.dupok = '1'; f.requestSubmit(); } return; }
  if (d.zoom) { setZoom(d.zoom); return; }
  if (d.act === 'autofill') { autoFill(); return; }
  if (d.fill) { fillField(d.fill, d.val); return; }
  if (d.sel) { el.checked ? SEL.add(d.sel) : SEL.delete(d.sel); rerender(); return; }
  if (d.selall) { const ids = d.selall.split(',').filter(Boolean); el.checked ? ids.forEach(i => SEL.add(i)) : ids.forEach(i => SEL.delete(i)); rerender(); return; }
  if (d.act === 'selclear') { SEL.clear(); rerender(); return; }
  if (d.act === 'delsel') { askDelete([...SEL].map(id => ['peserta', id])); return; }
  if (d.delask) { askDelete([[d.delask, d.id]]); return; }
  if (d.mact === 'cancel') { closeModal(); return; }
  if (d.mact === 'confirm') { doDelete(); return; }
  if (d.act === 'close') { if (REOPEN && document.getElementById('frm')) { const r = REOPEN; REOPEN = null; r(); } else closeDrawer(); return; }
  if (d.act === 'clearf') { F.tahun = F.kab = F.ring = F.mitra = ''; rerender(); return; }
  if (d.act === 'togglenik' && el.tagName === 'BUTTON') { SHOW_NIK = !SHOW_NIK; rerender(); if (DRAWER_CTX && DRAWER_CTX.reopen) DRAWER_CTX.reopen(); return; }
  
  if (d.act === 'rep-png') { repPNG(); return; }
  if (d.act === 'rep-svg') { download(repFileName('svg'), (REP._last || buildInfographic(REP)).svg, 'image/svg+xml'); toast('SVG diunduh'); return; }
  if (d.act === 'rep-print') { repPrint(); return; }
  if (d.act === 'rep-copy') { const txt = (REP._last || buildInfographic(REP)).narasi; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Narasi disalin'), () => { prompt('Salin narasi:', txt); }); return; }
  if (d.act === 'reload') { reloadFromServer(); return; }
  if (d.act === 'backup') { download(`ruangdata_salinan_${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({app:'Ruang Data', diunduh:new Date().toISOString(), data:DB}), 'application/json'); return; }
  if (d.act === 'reset') { if (confirm('Buang semua perubahan lokal dan kembali ke data dasar?')) { JOURNAL = []; storageSet(); loadBase(); reindex(); rerender(); toast('Perubahan lokal dibuang'); } return; }
  if (d.act === 'exportall') { Object.keys(SCHEMA).forEach((t,i) => setTimeout(() => download(`${String(i+1).padStart(2,'0')}_${t}.csv`, csvOf(t, DB[t])), i*250)); return; }
  if (d.export) { download(`${d.export}.csv`, csvOf(d.export, DB[d.export])); return; }
  if (d.exportView === 'enr') { const q = STATE.q.enr || {}; const rows = enrFiltered().filter(e => !q.prog || e.program_id === q.prog); download('keikutsertaan_terfilter.csv', csvOf('enrollment', rows)); return; }
  if (d.exportView === 'isu') { const q = STATE.q.isu || {}; download('log_isu_terfilter.csv', csvOf('log_isu_data', DB.log_isu_data.filter(i => (!q.jenis || i.jenis_isu === q.jenis) && (!q.status || i.status === q.status)))); return; }
  if (d.new) { const reopen = DRAWER_CTX && DRAWER_CTX.reopen; openForm(d.new, null, true, d.pre ? JSON.parse(d.pre) : {}); if (reopen) REOPEN = reopen; return; }
  if (d.edit) { const row = DB[d.edit].find(r => keyOf(d.edit, r) === d.id); const reopen = DRAWER_CTX && DRAWER_CTX.reopen; if (row) openForm(d.edit, row, false); if (reopen) REOPEN = reopen; return; }
  if (d.peserta) { const id = d.peserta; const fn = () => { pesertaDetail(id); DRAWER_CTX.reopen = fn; }; fn(); return; }
  if (d.usaha) { const id = d.usaha; const fn = () => { usahaDetail(id); DRAWER_CTX.reopen = fn; }; fn(); return; }
  if (d.page) { const [k, p] = d.page.split(':'); STATE.page[k] = +p; rerender(); return; }
  if (d.tab) { const [k, v] = d.tab.split(':'); STATE.tab[k] = v; Object.keys(STATE.page).forEach(x => STATE.page[x] = 0); route(); return; }
  if (d.isu) { const i = DB.log_isu_data.find(x => x.isu_id === d.isu); if (i) { commit('log_isu_data', {...i, status:'selesai'}); toast('Isu ditandai selesai'); rerender(); if (DRAWER_CTX && DRAWER_CTX.reopen) DRAWER_CTX.reopen(); } return; }
  if (d.isuj) { STATE.q.isu = {...(STATE.q.isu||{status:'terbuka'}), jenis: d.isuj}; STATE.page.isu = 0; rerender(); return; }
  if (d.go) { location.hash = d.go; return; }
});
document.addEventListener('change', ev => {
  const el = ev.target; const d = el.dataset;
  if (el.closest && el.closest('#frm')) { updateSugg(); return; }
  if (d.f) { F[d.f] = el.value; Object.keys(STATE.page).forEach(x => STATE.page[x] = 0); rerender(); return; }
  if (d.act === 'strict') { F.strict = el.checked; rerender(); return; }
  if (d.act === 'togglenik') { SHOW_NIK = el.checked; rerender(); return; }
  if (d.rep) { if (el.tagName === 'TEXTAREA' || el.type === 'text') return; REP[d.rep] = el.type === 'checkbox' ? el.checked : el.value; rerender(); return; }
  if (d.act === 'restore') { const f = el.files[0]; if (!f) return; f.text().then(txt => { try { const o = JSON.parse(txt); if (!['Ruang Data','SATUDATA'].includes(o.app) || !Array.isArray(o.journal)) throw 0; JOURNAL = o.journal; storageSet(); loadBase(); JOURNAL.forEach(applyOp); reindex(); rerender(); toast(`Cadangan dipulihkan (${fmt(JOURNAL.length)} perubahan)`); } catch(e) { toast('File cadangan tidak valid'); } }); return; }
  if (d.q && el.tagName === 'SELECT') { const [k, f] = d.q.split(':'); STATE.q[k] = {...(STATE.q[k]||{s:''}), [f]: el.value}; if (k==='peserta' && f==='pilar') STATE.q[k].prog = ''; STATE.page[k] = 0; rerender(); }
});
let qT, rT, sT; document.addEventListener('input', ev => {
  const el = ev.target; const d = el.dataset;
  if (el.closest && el.closest('#frm')) { clearTimeout(sT); sT = setTimeout(updateSugg, 150); }
  if (d.rep && (el.tagName === 'TEXTAREA' || el.type === 'text')) { REP[d.rep] = el.value; clearTimeout(rT); rT = setTimeout(() => { const inf = buildInfographic(REP); REP._last = inf; const pv = document.getElementById('rep-preview'); if (pv) pv.innerHTML = inf.svg.replace('<svg ', '<svg style="width:100%;height:auto;display:block" '); }, 300); return; }
  if (!d.q || el.tagName !== 'INPUT') return;
  clearTimeout(qT); qT = setTimeout(() => { const [k, f] = d.q.split(':'); STATE.q[k] = {...(STATE.q[k]||{}), [f]: el.value}; STATE.page[k] = 0; const pos = el.selectionStart; rerender(); const n = document.querySelector(`[data-q="${d.q}"]`); if (n) { n.focus(); n.setSelectionRange(pos,pos); } }, 250);
});
document.addEventListener('submit', ev => {
  
  if (ev.target.id !== 'frm') return; ev.preventDefault();
  const frm = ev.target; frm.querySelectorAll('[data-err]').forEach(e => e.textContent = '');
  const {t, row, errs} = readForm(frm);
  if (Object.keys(errs).length) { Object.entries(errs).forEach(([k, m]) => { const e = frm.querySelector(`[data-err="${k}"]`); if (e) e.textContent = m; else toast(m); }); const first = frm.querySelector('.err:not(:empty)'); if (first) first.scrollIntoView({block:'center'}); return; }
  if (t === 'peserta' && frm.dataset.isnew === '1' && frm.dataset.dupok !== '1') { const k = kandidatGanda(row); if (k.length) { tampilKandidat(frm, k); return; } }
  commit(t, row, frm.dataset.isnew === '1' ? 'ins' : 'up'); toast(SCHEMA[t].label + ' tersimpan');
  if (t === 'peserta' && frm.dataset.isnew === '1') { rerender(); const id = row.peserta_id; const fn = () => { pesertaDetail(id); DRAWER_CTX.reopen = fn; }; fn(); return; }
  rerender();
  if (REOPEN) { const r = REOPEN; REOPEN = null; r(); } else closeDrawer();
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { if ($('#modal').style.display === 'block') closeModal(); else closeDrawer(); } });
document.addEventListener('focusin', ev => { if (/^(INPUT|SELECT|TEXTAREA)$/.test(ev.target.tagName) && ev.target.closest('#frm')) updateSugg(); });
window.addEventListener('hashchange', () => { closeDrawer(); route(); });

/* ===================== boot ===================== */




loadBase(); reindex();
if (USER.role !== 'admin') document.body.classList.add('not-admin');
if (['viewer','mitra'].includes(USER.role)) document.body.classList.add('ro');
route();
return {reload: reloadFromServer, route};


};
