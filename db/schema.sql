-- Ruang Data · skema database Social Impact AMMAN (PostgreSQL 14+ / Neon)
-- Aman dijalankan ulang. Lokal: npm run db:apply (memakai DIRECT_URL)
-- Skema database Social Impact AMMAN — master data peserta (PostgreSQL 14+)
-- Dihasilkan otomatis dari spesifikasi yang sama dengan workbook & CSV. Urutan CREATE = urutan impor.
BEGIN;
CREATE SCHEMA IF NOT EXISTS si;
SET search_path TO si;

CREATE TABLE IF NOT EXISTS si.ref_pilihan (
  kategori text,
  kode text,
  label text NOT NULL,
  urutan smallint,
  PRIMARY KEY (kategori, kode)
);
COMMENT ON TABLE si.ref_pilihan IS 'Daftar kode untuk semua kolom pilihan (enum). Label dipakai di UI/laporan.';
COMMENT ON COLUMN si.ref_pilihan.kategori IS 'Nama kategori (= nama kolom/enum).';
COMMENT ON COLUMN si.ref_pilihan.kode IS 'Kode yang disimpan di tabel data.';
COMMENT ON COLUMN si.ref_pilihan.label IS 'Label tampilan.';
COMMENT ON COLUMN si.ref_pilihan.urutan IS 'Urutan tampil.';

CREATE TABLE IF NOT EXISTS si.ref_ppm_area (
  ppm_area_kode smallint,
  nama_kepmen text NOT NULL,
  nama_mapping text NOT NULL UNIQUE,
  dasar_hukum text,
  PRIMARY KEY (ppm_area_kode)
);
COMMENT ON TABLE si.ref_ppm_area IS '8 program utama PPM menurut Kepmen ESDM 1824 K/30/MEM/2018 dan padanannya di Program Mapping.';
COMMENT ON COLUMN si.ref_ppm_area.ppm_area_kode IS 'Nomor program area PPM (1–8).';
COMMENT ON COLUMN si.ref_ppm_area.nama_kepmen IS 'Nomenklatur Kepmen.';
COMMENT ON COLUMN si.ref_ppm_area.nama_mapping IS 'Nomenklatur Program Mapping Social Impact.';

CREATE TABLE IF NOT EXISTS si.ref_program (
  program_id text,
  pilar_kode text NOT NULL CHECK (pilar_kode IN ('HCD', 'EE', 'ST', 'CP', 'EPP')),
  pilar text NOT NULL,
  bidang_ppm text NOT NULL,
  ppm_area_kode smallint REFERENCES si.ref_ppm_area(ppm_area_kode),
  program text NOT NULL,
  sub_program text,
  sdgs text,
  aktif boolean NOT NULL,
  PRIMARY KEY (program_id)
);
COMMENT ON TABLE si.ref_program IS 'Program Mapping Social Impact: pilar → bidang PPM → program → sub-program.';
COMMENT ON COLUMN si.ref_program.program_id IS 'Kode program [PILAR]-[BIDANG]-[urut]. XX-99 = penampung belum terpetakan.';
COMMENT ON COLUMN si.ref_program.pilar_kode IS 'HCD / EE / ST / CP (lintas pilar) / EPP.';
COMMENT ON COLUMN si.ref_program.pilar IS 'Nama pilar.';
COMMENT ON COLUMN si.ref_program.bidang_ppm IS 'Program Area PPM (nomenklatur Program Mapping).';
COMMENT ON COLUMN si.ref_program.ppm_area_kode IS 'Nomor area PPM Kepmen 1824; kosong untuk program di luar PPM (EPP) dan penampung.';
COMMENT ON COLUMN si.ref_program.program IS 'Nama program.';
COMMENT ON COLUMN si.ref_program.sub_program IS 'Sub-program; kosong bila tidak ada.';
COMMENT ON COLUMN si.ref_program.sdgs IS 'SDGs terkait.';
COMMENT ON COLUMN si.ref_program.aktif IS 'FALSE untuk kode penampung.';

CREATE TABLE IF NOT EXISTS si.ref_wilayah (
  wilayah_id text,
  level text NOT NULL CHECK (level IN ('kabupaten', 'kecamatan', 'desa')),
  nama text NOT NULL,
  parent_id text REFERENCES si.ref_wilayah(wilayah_id),
  provinsi text,
  kabupaten text,
  kecamatan text,
  ring text CHECK (ring IN ('ring_1', 'ring_2', 'ring_3')),
  kode_kemendagri text,
  terverifikasi boolean NOT NULL,
  dasar_ring text,
  PRIMARY KEY (wilayah_id)
);
COMMENT ON TABLE si.ref_wilayah IS 'Hierarki wilayah kabupaten → kecamatan → desa, termasuk Ring.';
COMMENT ON COLUMN si.ref_wilayah.wilayah_id IS 'KAB-xx / KEC-xxx / DES-xxxx.';
COMMENT ON COLUMN si.ref_wilayah.level IS 'kabupaten/kecamatan/desa.';
COMMENT ON COLUMN si.ref_wilayah.nama IS 'Nama wilayah.';
COMMENT ON COLUMN si.ref_wilayah.parent_id IS 'Wilayah induk.';
COMMENT ON COLUMN si.ref_wilayah.provinsi IS 'Provinsi.';
COMMENT ON COLUMN si.ref_wilayah.kabupaten IS 'Nama kabupaten (denormalisasi untuk filter).';
COMMENT ON COLUMN si.ref_wilayah.kecamatan IS 'Nama kecamatan.';
COMMENT ON COLUMN si.ref_wilayah.ring IS 'Ring wilayah (asumsi awal, lihat dasar_ring).';
COMMENT ON COLUMN si.ref_wilayah.kode_kemendagri IS 'Kode wilayah Kemendagri — WAJIB dilengkapi sebelum produksi.';
COMMENT ON COLUMN si.ref_wilayah.terverifikasi IS 'TRUE bila nama & kode wilayah sudah dicek.';
COMMENT ON COLUMN si.ref_wilayah.dasar_ring IS 'Dasar penentuan ring.';

CREATE TABLE IF NOT EXISTS si.asumsi_penghasilan (
  pendidikan text CHECK (pendidikan IN ('tidak_sekolah', 'sd', 'smp', 'sma', 'smk', 'd1_d3', 's1_d4', 's2', 's3')),
  upah_bulanan_asumsi numeric(14,2) NOT NULL,
  periode_acuan text,
  sumber text,
  PRIMARY KEY (pendidikan)
);
COMMENT ON TABLE si.asumsi_penghasilan IS 'Upah asumsi per pendidikan untuk imputasi baseline penghasilan.';
COMMENT ON COLUMN si.asumsi_penghasilan.pendidikan IS 'Kode pendidikan.';
COMMENT ON COLUMN si.asumsi_penghasilan.upah_bulanan_asumsi IS 'Rupiah per bulan.';
COMMENT ON COLUMN si.asumsi_penghasilan.periode_acuan IS 'Periode data acuan.';
COMMENT ON COLUMN si.asumsi_penghasilan.sumber IS 'Sumber angka.';

CREATE TABLE IF NOT EXISTS si.mitra (
  mitra_id text,
  nama_mitra text NOT NULL UNIQUE,
  jenis_mitra text,
  catatan text,
  PRIMARY KEY (mitra_id)
);
COMMENT ON TABLE si.mitra IS 'Mitra pelaksana program.';
COMMENT ON COLUMN si.mitra.mitra_id IS 'ID mitra.';
COMMENT ON COLUMN si.mitra.nama_mitra IS 'Nama mitra (sudah diseragamkan).';
COMMENT ON COLUMN si.mitra.jenis_mitra IS 'Mis. NGO, perusahaan, sekolah, pemerintah.';

CREATE TABLE IF NOT EXISTS si.mitra_kontak (
  kontak_id text,
  mitra_id text NOT NULL REFERENCES si.mitra(mitra_id),
  nama_kontak text,
  posisi text,
  whatsapp text,
  email text,
  PRIMARY KEY (kontak_id)
);
COMMENT ON TABLE si.mitra_kontak IS 'Narahubung mitra.';
COMMENT ON COLUMN si.mitra_kontak.kontak_id IS 'ID kontak.';
COMMENT ON COLUMN si.mitra_kontak.mitra_id IS 'Mitra.';
COMMENT ON COLUMN si.mitra_kontak.whatsapp IS 'Nomor diseragamkan (08…).';

CREATE TABLE IF NOT EXISTS si.konversi_program_lama (
  konversi_id text,
  mitra_id text REFERENCES si.mitra(mitra_id),
  nama_mitra_lama text NOT NULL,
  nama_program_lama text NOT NULL,
  program_id text NOT NULL REFERENCES si.ref_program(program_id),
  status_mapping text NOT NULL CHECK (status_mapping IN ('sesuai', 'perlu_verifikasi', 'belum_terpetakan')),
  alasan text,
  PRIMARY KEY (konversi_id),
  UNIQUE (nama_mitra_lama, nama_program_lama)
);
COMMENT ON TABLE si.konversi_program_lama IS 'Jejak konversi nama program lama (mitra) → Program Mapping.';
COMMENT ON COLUMN si.konversi_program_lama.konversi_id IS 'ID konversi.';
COMMENT ON COLUMN si.konversi_program_lama.nama_mitra_lama IS 'Nama mitra persis seperti data lama.';
COMMENT ON COLUMN si.konversi_program_lama.nama_program_lama IS 'Nama program persis seperti data lama.';
COMMENT ON COLUMN si.konversi_program_lama.program_id IS 'Hasil pemetaan.';
COMMENT ON COLUMN si.konversi_program_lama.status_mapping IS 'sesuai / perlu_verifikasi / belum_terpetakan.';
COMMENT ON COLUMN si.konversi_program_lama.alasan IS 'Dasar/keraguan pemetaan.';

CREATE TABLE IF NOT EXISTS si.rumah_tangga (
  rumah_tangga_id text,
  no_kk text,
  status_no_kk text NOT NULL CHECK (status_no_kk IN ('valid', 'kosong', 'panjang_salah', 'rusak_0000', 'non_digit')),
  nama_ayah text,
  nama_ibu text,
  nama_wali text,
  PRIMARY KEY (rumah_tangga_id)
);
COMMENT ON TABLE si.rumah_tangga IS 'Rumah tangga (Kartu Keluarga). Satu KK valid = satu baris, dipakai bersama oleh peserta sekeluarga.';
COMMENT ON COLUMN si.rumah_tangga.rumah_tangga_id IS 'ID rumah tangga.';
COMMENT ON COLUMN si.rumah_tangga.no_kk IS 'Nomor KK (teks 16 digit).';
COMMENT ON COLUMN si.rumah_tangga.status_no_kk IS 'Hasil validasi format No. KK.';

CREATE TABLE IF NOT EXISTS si.peserta (
  peserta_id text,
  nik text,
  status_nik text NOT NULL CHECK (status_nik IN ('valid', 'kosong', 'panjang_salah', 'rusak_0000', 'non_digit')),
  nama text,
  tanggal_lahir date,
  jenis_kelamin text CHECK (jenis_kelamin IN ('laki_laki', 'perempuan')),
  status_pernikahan text CHECK (status_pernikahan IN ('belum_menikah', 'menikah', 'cerai')),
  wilayah_id text REFERENCES si.ref_wilayah(wilayah_id),
  alamat_domisili text,
  rumah_tangga_id text REFERENCES si.rumah_tangga(rumah_tangga_id),
  telepon text,
  email text,
  instagram text,
  facebook text,
  linkedin text,
  sosmed_lain text,
  disabilitas boolean,
  jenis_disabilitas text CHECK (jenis_disabilitas IN ('fisik', 'intelektual', 'mental', 'sensorik', 'ganda')),
  kelompok_rentan text CHECK (kelompok_rentan IN ('tidak_ada', 'miskin_dtks', 'perempuan_kk', 'putus_sekolah', 'masyarakat_adat', 'lainnya')),
  consent_data boolean,
  tanggal_consent date,
  metode_dedup text NOT NULL CHECK (metode_dedup IN ('nik', 'nama_tgl_lahir', 'tunggal')),
  catatan text,
  PRIMARY KEY (peserta_id),
  CHECK (status_nik <> 'valid' OR nik ~ '^[0-9]{16}$')
);
COMMENT ON TABLE si.peserta IS 'Satu baris = satu orang (unik lintas pilar & program).';
COMMENT ON COLUMN si.peserta.peserta_id IS 'ID peserta unik.';
COMMENT ON COLUMN si.peserta.nik IS 'NIK 16 digit. Unik bila status_nik = valid. Enkripsi/akses terbatas di produksi.';
COMMENT ON COLUMN si.peserta.status_nik IS 'Hasil validasi format NIK.';
COMMENT ON COLUMN si.peserta.nama IS 'Nama sesuai KTP.';
COMMENT ON COLUMN si.peserta.wilayah_id IS 'Wilayah sesuai KTP, level paling rinci yang tersedia.';
COMMENT ON COLUMN si.peserta.alamat_domisili IS 'Alamat tinggal saat ini.';
COMMENT ON COLUMN si.peserta.telepon IS 'Diseragamkan 08…';
COMMENT ON COLUMN si.peserta.email IS 'Lowercase, format divalidasi.';
COMMENT ON COLUMN si.peserta.disabilitas IS 'TRUE/FALSE; kosong = belum diketahui.';
COMMENT ON COLUMN si.peserta.consent_data IS 'Persetujuan pemrosesan data pribadi (UU 27/2022).';
COMMENT ON COLUMN si.peserta.metode_dedup IS 'Cara catatan lama digabung.';

CREATE TABLE IF NOT EXISTS si.enrollment (
  enrollment_id text,
  peserta_id text NOT NULL REFERENCES si.peserta(peserta_id),
  program_id text NOT NULL REFERENCES si.ref_program(program_id),
  mitra_id text REFERENCES si.mitra(mitra_id),
  konversi_id text REFERENCES si.konversi_program_lama(konversi_id),
  nama_program_mitra text,
  batch smallint,
  tahun_mulai smallint,
  tahun_selesai smallint,
  status_partisipasi text CHECK (status_partisipasi IN ('terdaftar', 'berjalan', 'selesai', 'drop_out')),
  status_kelulusan text CHECK (status_kelulusan IN ('lulus', 'tidak_lulus', 'berjalan')),
  tingkat_kehadiran numeric(5,4),
  peran_peserta text CHECK (peran_peserta IN ('peserta', 'pemain_atlet', 'pelatih', 'wasit', 'ibu_hamil', 'ibu_balita', 'balita', 'kader_posyandu', 'anggota_pokdarwis', 'pengelola_usaha_wisata', 'pemandu_wisata', 'lifeguard', 'instruktur_selancar', 'anggota_kelompok_konservasi', 'pemilik_usaha', 'karyawan_usaha', 'anggota_kelompok_usaha', 'calon_wirausaha', 'lainnya')),
  unit_kelompok text,
  kode_lama text,
  catatan text,
  sumber_data text,
  PRIMARY KEY (enrollment_id),
  CHECK (tingkat_kehadiran IS NULL OR tingkat_kehadiran BETWEEN 0 AND 1)
);
COMMENT ON TABLE si.enrollment IS 'Keikutsertaan: satu baris = satu peserta dalam satu program/batch.';
COMMENT ON COLUMN si.enrollment.enrollment_id IS 'ID keikutsertaan.';
COMMENT ON COLUMN si.enrollment.konversi_id IS 'Jejak konversi (data lama).';
COMMENT ON COLUMN si.enrollment.nama_program_mitra IS 'Nama program versi mitra.';
COMMENT ON COLUMN si.enrollment.tingkat_kehadiran IS 'Proporsi 0–1.';
COMMENT ON COLUMN si.enrollment.unit_kelompok IS 'Tim/sekolah/posyandu/pokdarwis/kelompok.';
COMMENT ON COLUMN si.enrollment.kode_lama IS 'ID baris di workbook versi per pilar (HCD-00001 dst.).';

CREATE TABLE IF NOT EXISTS si.baseline_peserta (
  baseline_id text,
  enrollment_id text NOT NULL UNIQUE REFERENCES si.enrollment(enrollment_id) ON DELETE CASCADE,
  tanggal_baseline date,
  motivasi text,
  pendidikan_terakhir text CHECK (pendidikan_terakhir IN ('tidak_sekolah', 'sd', 'smp', 'sma', 'smk', 'd1_d3', 's1_d4', 's2', 's3')),
  jurusan text,
  institusi_pendidikan text,
  nilai_akademik numeric(5,2),
  skala_nilai smallint,
  pekerjaan_sebelum text,
  penghasilan_bulanan_sebelum numeric(14,2),
  jumlah_art smallint,
  jumlah_art_bekerja smallint,
  penghasil_utama text CHECK (penghasil_utama IN ('orang_tua', 'ayah', 'ibu', 'wali', 'diri_sendiri', 'saudara', 'lainnya')),
  kategori_penghasilan_rt text CHECK (kategori_penghasilan_rt IN ('lt_2_9jt', '2_9_sd_5jt', 'gt_5jt')),
  penerima_bansos_dtks boolean,
  pekerjaan_ayah text,
  pekerjaan_ibu text,
  pekerjaan_wali text,
  status_pernikahan_ortu text CHECK (status_pernikahan_ortu IN ('belum_menikah', 'menikah', 'cerai')),
  jumlah_saudara_kandung smallint,
  PRIMARY KEY (baseline_id),
  CHECK (skala_nilai IS NULL OR skala_nilai IN (4, 10, 100)),
  CHECK (nilai_akademik IS NULL OR (skala_nilai IS NOT NULL AND nilai_akademik > 0 AND nilai_akademik <= skala_nilai))
);
COMMENT ON TABLE si.baseline_peserta IS 'Kondisi peserta & rumah tangga saat mendaftar (HCD, ST). Satu per enrollment.';
COMMENT ON COLUMN si.baseline_peserta.tanggal_baseline IS 'Tanggal pengambilan data.';
COMMENT ON COLUMN si.baseline_peserta.nilai_akademik IS 'IPK (skala 4) atau nilai rata-rata rapor/ijazah (skala 10/100).';
COMMENT ON COLUMN si.baseline_peserta.skala_nilai IS 'Skala nilai_akademik: 4, 10, atau 100.';
COMMENT ON COLUMN si.baseline_peserta.penghasilan_bulanan_sebelum IS 'Rupiah/bulan; 0 = tidak berpenghasilan.';

CREATE TABLE IF NOT EXISTS si.tracer_ketenagakerjaan (
  tracer_id text,
  enrollment_id text NOT NULL REFERENCES si.enrollment(enrollment_id) ON DELETE CASCADE,
  putaran text NOT NULL CHECK (putaran IN ('baseline', 'midline', 'endline', 'tracer_6bln', 'tracer_12bln', 'pemantauan_rutin', 'data_lama')),
  tanggal_tracer date,
  status_pekerjaan text CHECK (status_pekerjaan IN ('full_time', 'part_time', 'self_employed', 'internship', 'lanjut_studi', 'mencari_kerja', 'tidak_mencari_kerja')),
  jabatan text,
  institusi_kerja text,
  sektor_pekerjaan text CHECK (sektor_pekerjaan IN ('tambang_amman', 'tambang_kontraktor_amman', 'tambang_lain', 'pariwisata', 'ti', 'pendidikan', 'pemerintahan', 'wirausaha', 'lainnya')),
  lokasi_kerja text CHECK (lokasi_kerja IN ('ksb', 'ntb_luar_ksb', 'luar_ntb', 'luar_negeri')),
  tanggal_mulai_kerja date,
  penghasilan_bulanan numeric(14,2),
  catatan text,
  PRIMARY KEY (tracer_id)
);
COMMENT ON TABLE si.tracer_ketenagakerjaan IS 'Outcome ketenagakerjaan; boleh banyak putaran per enrollment.';
COMMENT ON COLUMN si.tracer_ketenagakerjaan.putaran IS 'Putaran pengukuran.';
COMMENT ON COLUMN si.tracer_ketenagakerjaan.penghasilan_bulanan IS 'Rupiah/bulan.';

CREATE TABLE IF NOT EXISTS si.sertifikasi (
  sertifikasi_id text,
  enrollment_id text NOT NULL REFERENCES si.enrollment(enrollment_id) ON DELETE CASCADE,
  jenis_sertifikasi text NOT NULL CHECK (jenis_sertifikasi IN ('hospitality_bnsp', 'lifeguard', 'surf_instructor', 'alat_berat_sio', 'digital_it', 'lainnya')),
  nama_sertifikat text,
  lembaga_penerbit text,
  nomor_sertifikat text,
  tanggal_terbit date,
  berlaku_sampai date,
  PRIMARY KEY (sertifikasi_id)
);
COMMENT ON TABLE si.sertifikasi IS 'Sertifikat yang diperoleh peserta.';

CREATE TABLE IF NOT EXISTS si.pengukuran_kesehatan (
  pengukuran_id text,
  enrollment_id text NOT NULL REFERENCES si.enrollment(enrollment_id) ON DELETE CASCADE,
  putaran text NOT NULL CHECK (putaran IN ('baseline', 'midline', 'endline', 'tracer_6bln', 'tracer_12bln', 'pemantauan_rutin', 'data_lama')),
  tanggal_ukur date NOT NULL,
  tinggi_cm numeric(5,1),
  berat_kg numeric(5,2),
  status_gizi text CHECK (status_gizi IN ('normal', 'stunting', 'wasting', 'underweight', 'overweight')),
  catatan text,
  PRIMARY KEY (pengukuran_id)
);
COMMENT ON TABLE si.pengukuran_kesehatan IS 'Antropometri/screening (stunting, KLA, health screening).';
COMMENT ON COLUMN si.pengukuran_kesehatan.status_gizi IS 'Klasifikasi tenaga kesehatan.';

CREATE TABLE IF NOT EXISTS si.kontribusi_lingkungan (
  kontribusi_id text,
  enrollment_id text NOT NULL REFERENCES si.enrollment(enrollment_id) ON DELETE CASCADE,
  tanggal date,
  jenis_kegiatan text,
  lokasi text,
  volume numeric(12,2),
  satuan text,
  PRIMARY KEY (kontribusi_id)
);
COMMENT ON TABLE si.kontribusi_lingkungan IS 'Kontribusi peserta pada kegiatan konservasi/pariwisata.';
COMMENT ON COLUMN si.kontribusi_lingkungan.jenis_kegiatan IS 'Mis. tanam mangrove, transplantasi karang, pelepasan tukik.';
COMMENT ON COLUMN si.kontribusi_lingkungan.satuan IS 'bibit, m², ekor, dll.';

CREATE TABLE IF NOT EXISTS si.usaha (
  usaha_id text,
  nama_usaha text,
  sektor_usaha text CHECK (sektor_usaha IN ('fnb', 'fashion_kriya', 'agribisnis', 'manufaktur', 'jasa', 'pengolahan_sampah', 'lainnya')),
  produk_utama text,
  tanggal_berdiri date,
  wilayah_id text REFERENCES si.ref_wilayah(wilayah_id),
  nama_kelompok text,
  catatan text,
  PRIMARY KEY (usaha_id)
);
COMMENT ON TABLE si.usaha IS 'Usaha/UMKM sebagai entitas tersendiri (bisa dimiliki/dipekerjakan beberapa peserta).';
COMMENT ON COLUMN si.usaha.nama_usaha IS 'Nama usaha/merek.';
COMMENT ON COLUMN si.usaha.wilayah_id IS 'Lokasi usaha.';
COMMENT ON COLUMN si.usaha.nama_kelompok IS 'Kelompok/koperasi/BUMDes.';

CREATE TABLE IF NOT EXISTS si.peserta_usaha (
  peserta_usaha_id text,
  enrollment_id text NOT NULL REFERENCES si.enrollment(enrollment_id) ON DELETE CASCADE,
  usaha_id text NOT NULL REFERENCES si.usaha(usaha_id) ON DELETE CASCADE,
  peran_usaha text CHECK (peran_usaha IN ('pemilik', 'karyawan', 'anggota_kelompok', 'calon_wirausaha')),
  PRIMARY KEY (peserta_usaha_id)
);
COMMENT ON TABLE si.peserta_usaha IS 'Relasi enrollment EE ↔ usaha beserta peran.';

CREATE TABLE IF NOT EXISTS si.usaha_legalitas (
  legalitas_id text,
  usaha_id text NOT NULL REFERENCES si.usaha(usaha_id) ON DELETE CASCADE,
  jenis_legalitas text NOT NULL CHECK (jenis_legalitas IN ('nib', 'pirt', 'bpom', 'halal', 'hki')),
  dimiliki boolean NOT NULL,
  nomor_izin text,
  tanggal_terbit date,
  putaran text CHECK (putaran IN ('baseline', 'midline', 'endline', 'tracer_6bln', 'tracer_12bln', 'pemantauan_rutin', 'data_lama')),
  sumber_data text,
  PRIMARY KEY (legalitas_id),
  UNIQUE (usaha_id, jenis_legalitas)
);
COMMENT ON TABLE si.usaha_legalitas IS 'Status legalitas usaha (format panjang: satu jenis izin per baris).';

CREATE TABLE IF NOT EXISTS si.usaha_pemantauan (
  pemantauan_id text,
  usaha_id text NOT NULL REFERENCES si.usaha(usaha_id) ON DELETE CASCADE,
  putaran text NOT NULL CHECK (putaran IN ('baseline', 'midline', 'endline', 'tracer_6bln', 'tracer_12bln', 'pemantauan_rutin', 'data_lama')),
  tanggal_pemantauan date,
  status_usaha text CHECK (status_usaha IN ('aktif', 'vakum', 'berhenti', 'belum_mulai')),
  tenaga_kerja_total smallint,
  tenaga_kerja_perempuan smallint,
  kanal_pemasaran text CHECK (kanal_pemasaran IN ('offline', 'media_sosial', 'ecommerce', 'offline_online')),
  menjual_ecommerce boolean,
  pernah_menerima_investasi boolean,
  catatan text,
  PRIMARY KEY (pemantauan_id)
);
COMMENT ON TABLE si.usaha_pemantauan IS 'Kondisi usaha per putaran (status, tenaga kerja, pemasaran).';

CREATE TABLE IF NOT EXISTS si.usaha_omzet_bulanan (
  omzet_id text,
  usaha_id text NOT NULL REFERENCES si.usaha(usaha_id) ON DELETE CASCADE,
  periode date NOT NULL,
  omzet numeric(16,2),
  volume_produksi numeric(12,2),
  satuan_produksi text,
  sumber_data text,
  PRIMARY KEY (omzet_id),
  UNIQUE (usaha_id, periode),
  CHECK (date_trunc('month', periode) = periode)
);
COMMENT ON TABLE si.usaha_omzet_bulanan IS 'Omzet bulanan per usaha (satu baris per usaha per bulan).';
COMMENT ON COLUMN si.usaha_omzet_bulanan.periode IS 'Tanggal 1 bulan bersangkutan.';
COMMENT ON COLUMN si.usaha_omzet_bulanan.omzet IS 'Rupiah.';

CREATE TABLE IF NOT EXISTS si.lembaga_komunitas (
  lembaga_id text,
  nama_lembaga text NOT NULL,
  jenis_lembaga text NOT NULL CHECK (jenis_lembaga IN ('bumdes', 'koperasi', 'pokdarwis', 'kelompok_usaha', 'kelompok_konservasi', 'karang_taruna', 'posyandu', 'kelompok_tani_nelayan', 'lainnya')),
  program_id text REFERENCES si.ref_program(program_id),
  wilayah_id text REFERENCES si.ref_wilayah(wilayah_id),
  tahun_dibentuk smallint,
  berbadan_hukum boolean,
  jumlah_anggota integer,
  jumlah_anggota_perempuan integer,
  tingkat_kemandirian text CHECK (tingkat_kemandirian IN ('pemula', 'berkembang', 'mandiri')),
  catatan text,
  PRIMARY KEY (lembaga_id)
);
COMMENT ON TABLE si.lembaga_komunitas IS 'Kelembagaan komunitas yang dibentuk/diperkuat (PPM area 7).';
COMMENT ON COLUMN si.lembaga_komunitas.tingkat_kemandirian IS 'Hasil asesmen kapasitas lembaga.';

CREATE TABLE IF NOT EXISTS si.infrastruktur (
  infrastruktur_id text,
  nama_aset text NOT NULL,
  jenis_infrastruktur text NOT NULL CHECK (jenis_infrastruktur IN ('air_bersih', 'sanitasi', 'jalan_desa', 'fasilitas_wisata', 'fasilitas_pendidikan', 'fasilitas_kesehatan', 'energi', 'fasilitas_ekonomi', 'lainnya')),
  program_id text REFERENCES si.ref_program(program_id),
  wilayah_id text REFERENCES si.ref_wilayah(wilayah_id),
  tahun_selesai smallint,
  nilai_investasi numeric(16,2),
  status_aset text CHECK (status_aset IN ('perencanaan', 'konstruksi', 'beroperasi', 'diserahterimakan', 'rusak')),
  penerima_manfaat_kk integer,
  penerima_manfaat_jiwa integer,
  lembaga_pengelola_id text REFERENCES si.lembaga_komunitas(lembaga_id),
  latitude numeric(9,6),
  longitude numeric(9,6),
  catatan text,
  PRIMARY KEY (infrastruktur_id)
);
COMMENT ON TABLE si.infrastruktur IS 'Aset infrastruktur pendukung PPM (PPM area 8).';
COMMENT ON COLUMN si.infrastruktur.nilai_investasi IS 'Rupiah.';
COMMENT ON COLUMN si.infrastruktur.penerima_manfaat_kk IS 'Jumlah KK penerima manfaat.';
COMMENT ON COLUMN si.infrastruktur.penerima_manfaat_jiwa IS 'Jumlah jiwa penerima manfaat.';

CREATE TABLE IF NOT EXISTS si.capaian_agregat (
  capaian_id text,
  nama_kegiatan text NOT NULL,
  program_id text REFERENCES si.ref_program(program_id),
  tahun smallint,
  jumlah_penerima integer,
  satuan text,
  catatan text,
  PRIMARY KEY (capaian_id)
);
COMMENT ON TABLE si.capaian_agregat IS 'Capaian tanpa data per orang (mis. donasi massal).';

CREATE TABLE IF NOT EXISTS si.log_isu_data (
  isu_id text,
  tabel text NOT NULL,
  record_id text,
  kolom text,
  nilai_asli text,
  jenis_isu text NOT NULL,
  tindakan text,
  status text NOT NULL CHECK (status IN ('terbuka', 'selesai', 'info')),
  PRIMARY KEY (isu_id)
);
COMMENT ON TABLE si.log_isu_data IS 'Temuan kualitas data dari migrasi; dipakai sebagai daftar kerja pembersihan.';

-- NIK valid harus unik (NIK rusak/kosong boleh berulang sampai diperbaiki)
CREATE UNIQUE INDEX IF NOT EXISTS ux_peserta_nik_valid ON si.peserta(nik) WHERE status_nik = 'valid';
CREATE INDEX IF NOT EXISTS ix_enrollment_peserta ON si.enrollment(peserta_id);
CREATE INDEX IF NOT EXISTS ix_enrollment_program ON si.enrollment(program_id);
CREATE INDEX IF NOT EXISTS ix_peserta_wilayah ON si.peserta(wilayah_id);
CREATE INDEX IF NOT EXISTS ix_tracer_enrollment ON si.tracer_ketenagakerjaan(enrollment_id);
CREATE INDEX IF NOT EXISTS ix_omzet_usaha ON si.usaha_omzet_bulanan(usaha_id, periode);

-- ================= VIEW ANALITIK =================
CREATE OR REPLACE VIEW si.v_enrollment_detail AS
SELECT e.*, p.nama, p.nik, p.jenis_kelamin, p.tanggal_lahir, p.disabilitas, p.kelompok_rentan,
       rp.pilar_kode, rp.pilar, rp.bidang_ppm, rp.ppm_area_kode, rp.program, rp.sub_program, rp.sdgs,
       w.kabupaten, w.kecamatan, CASE WHEN w.level = 'desa' THEN w.nama END AS desa, w.ring,
       e.tahun_mulai - EXTRACT(YEAR FROM p.tanggal_lahir)::int AS usia_saat_mulai,
       CASE WHEN p.tanggal_lahir IS NULL OR e.tahun_mulai IS NULL THEN NULL
            WHEN e.tahun_mulai - EXTRACT(YEAR FROM p.tanggal_lahir) < 16 THEN 'anak_lt16'
            WHEN e.tahun_mulai - EXTRACT(YEAR FROM p.tanggal_lahir) <= 30 THEN 'pemuda_16_30'
            WHEN e.tahun_mulai - EXTRACT(YEAR FROM p.tanggal_lahir) < 60 THEN 'dewasa_31_59'
            ELSE 'lansia_60plus' END AS kelompok_usia,
       k.status_mapping
FROM si.enrollment e
JOIN si.peserta p ON p.peserta_id = e.peserta_id
JOIN si.ref_program rp ON rp.program_id = e.program_id
LEFT JOIN si.ref_wilayah w ON w.wilayah_id = p.wilayah_id
LEFT JOIN si.konversi_program_lama k ON k.konversi_id = e.konversi_id;
-- Penerima manfaat unik (orang) vs keikutsertaan (enrollment) per pilar
CREATE OR REPLACE VIEW si.v_penerima_manfaat_pilar AS
SELECT rp.pilar_kode, rp.pilar,
       COUNT(*) AS jumlah_enrollment,
       COUNT(DISTINCT e.peserta_id) AS penerima_manfaat_unik,
       COUNT(DISTINCT e.peserta_id) FILTER (WHERE p.jenis_kelamin = 'perempuan') AS perempuan_unik,
       COUNT(DISTINCT e.peserta_id) FILTER (WHERE p.disabilitas) AS disabilitas_unik
FROM si.enrollment e JOIN si.peserta p USING (peserta_id) JOIN si.ref_program rp USING (program_id)
GROUP BY ROLLUP ((rp.pilar_kode, rp.pilar));
CREATE OR REPLACE VIEW si.v_ringkasan_program AS
SELECT d.program_id, d.pilar_kode, d.program, d.sub_program,
       COUNT(*) AS jumlah_enrollment, COUNT(DISTINCT d.peserta_id) AS peserta_unik,
       COUNT(*) FILTER (WHERE d.jenis_kelamin = 'laki_laki') AS laki_laki,
       COUNT(*) FILTER (WHERE d.jenis_kelamin = 'perempuan') AS perempuan,
       COUNT(*) FILTER (WHERE d.disabilitas) AS disabilitas,
       COUNT(*) FILTER (WHERE d.kelompok_usia = 'pemuda_16_30') AS pemuda_16_30,
       COUNT(*) FILTER (WHERE d.ring = 'ring_1') AS ring_1, COUNT(*) FILTER (WHERE d.ring = 'ring_2') AS ring_2,
       COUNT(*) FILTER (WHERE d.ring = 'ring_3') AS ring_3,
       COUNT(*) FILTER (WHERE d.status_partisipasi = 'drop_out') AS drop_out
FROM si.v_enrollment_detail d GROUP BY 1,2,3,4;
CREATE OR REPLACE VIEW si.v_tracer_terakhir AS
SELECT DISTINCT ON (enrollment_id) *
FROM si.tracer_ketenagakerjaan
ORDER BY enrollment_id, tanggal_tracer DESC NULLS LAST, tracer_id DESC;
-- Perubahan penghasilan: baseline (aktual >0, atau upah asumsi menurut pendidikan) vs tracer terakhir; hanya status bekerja
CREATE OR REPLACE VIEW si.v_perubahan_penghasilan AS
SELECT e.enrollment_id, e.peserta_id, e.program_id, t.status_pekerjaan, t.penghasilan_bulanan AS penghasilan_setelah,
       b.penghasilan_bulanan_sebelum,
       CASE WHEN b.penghasilan_bulanan_sebelum > 0 THEN b.penghasilan_bulanan_sebelum ELSE a.upah_bulanan_asumsi END AS baseline_terimputasi,
       CASE WHEN b.penghasilan_bulanan_sebelum > 0 THEN 'aktual' WHEN a.upah_bulanan_asumsi IS NOT NULL THEN 'asumsi_pendidikan' END AS sumber_baseline,
       CASE WHEN t.status_pekerjaan IN ('full_time','part_time','self_employed','internship') AND t.penghasilan_bulanan IS NOT NULL
             AND COALESCE(NULLIF(b.penghasilan_bulanan_sebelum,0), a.upah_bulanan_asumsi) > 0
            THEN (t.penghasilan_bulanan - COALESCE(NULLIF(b.penghasilan_bulanan_sebelum,0), a.upah_bulanan_asumsi))
                 / COALESCE(NULLIF(b.penghasilan_bulanan_sebelum,0), a.upah_bulanan_asumsi) END AS perubahan_pct
FROM si.enrollment e
JOIN si.v_tracer_terakhir t USING (enrollment_id)
LEFT JOIN si.baseline_peserta b USING (enrollment_id)
LEFT JOIN si.asumsi_penghasilan a ON a.pendidikan = b.pendidikan_terakhir;
CREATE OR REPLACE VIEW si.v_omzet_usaha AS
WITH o AS (
  SELECT usaha_id, periode, omzet,
         ROW_NUMBER() OVER (PARTITION BY usaha_id ORDER BY periode) AS rn_awal,
         ROW_NUMBER() OVER (PARTITION BY usaha_id ORDER BY periode DESC) AS rn_akhir
  FROM si.usaha_omzet_bulanan WHERE omzet IS NOT NULL)
SELECT u.usaha_id, u.nama_usaha, u.sektor_usaha,
       COUNT(o.*) AS jumlah_bulan, MIN(o.periode) AS periode_awal, MAX(o.periode) AS periode_akhir,
       MAX(o.omzet) FILTER (WHERE o.rn_awal = 1) AS omzet_awal, MAX(o.omzet) FILTER (WHERE o.rn_akhir = 1) AS omzet_akhir,
       ROUND(AVG(o.omzet), 0) AS omzet_rata2,
       CASE WHEN COUNT(o.*) >= 2 AND MAX(o.omzet) FILTER (WHERE o.rn_awal = 1) > 0
            THEN MAX(o.omzet) FILTER (WHERE o.rn_akhir = 1) / MAX(o.omzet) FILTER (WHERE o.rn_awal = 1) - 1 END AS perubahan_pct,
       CASE WHEN AVG(o.omzet) IS NULL THEN NULL WHEN AVG(o.omzet)*12 <= 2e9 THEN 'mikro' WHEN AVG(o.omzet)*12 <= 15e9 THEN 'kecil'
            WHEN AVG(o.omzet)*12 <= 50e9 THEN 'menengah' ELSE 'besar' END AS skala_usaha_pp7_2021
FROM si.usaha u LEFT JOIN o ON o.usaha_id = u.usaha_id
GROUP BY u.usaha_id, u.nama_usaha, u.sektor_usaha;
CREATE OR REPLACE VIEW si.v_capaian_area_ppm AS
SELECT a.ppm_area_kode, a.nama_kepmen,
       (SELECT COUNT(DISTINCT e.peserta_id) FROM si.enrollment e JOIN si.ref_program rp USING (program_id) WHERE rp.ppm_area_kode = a.ppm_area_kode) AS penerima_manfaat_unik,
       (SELECT COUNT(*) FROM si.lembaga_komunitas l JOIN si.ref_program rp USING (program_id) WHERE rp.ppm_area_kode = a.ppm_area_kode) AS jumlah_lembaga,
       (SELECT COUNT(*) FROM si.infrastruktur i JOIN si.ref_program rp USING (program_id) WHERE rp.ppm_area_kode = a.ppm_area_kode) AS jumlah_infrastruktur
FROM si.ref_ppm_area a ORDER BY 1;
CREATE OR REPLACE VIEW si.v_isu_terbuka AS
SELECT tabel, jenis_isu, COUNT(*) AS jumlah FROM si.log_isu_data WHERE status = 'terbuka' GROUP BY 1,2 ORDER BY 3 DESC;

-- ================= CATATAN KEAMANAN (aktifkan di produksi) =================
-- 1) Batasi akses kolom NIK/no_kk: simpan terenkripsi (pgcrypto) atau pisahkan ke tabel peserta_identitas dengan RLS ketat.
-- 2) Aktifkan Row Level Security: mitra hanya melihat enrollment dengan mitra_id miliknya.
-- 3) Tambahkan kolom audit (created_at, created_by, updated_at, updated_by) bila memakai aplikasi input.
COMMIT;


-- ================= PENGGUNA APLIKASI (login mandiri + RBAC) =================
BEGIN;
CREATE TABLE IF NOT EXISTS si.app_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text,                       -- bcrypt; NULL = belum bisa login
  nama text,
  role text CHECK (role IN ('admin','editor','viewer','mitra')),   -- NULL = mendaftar sendiri, menunggu persetujuan admin
  mitra_id text REFERENCES si.mitra(mitra_id),
  aktif boolean NOT NULL DEFAULT true,
  wajib_ganti_sandi boolean NOT NULL DEFAULT true,
  gagal_login smallint NOT NULL DEFAULT 0,
  kunci_sampai timestamptz,
  sesi_versi integer NOT NULL DEFAULT 1,    -- dinaikkan untuk membatalkan semua sesi pengguna
  login_terakhir timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (role <> 'mitra' OR mitra_id IS NOT NULL)
);
-- migrasi dari skema lama (Supabase)
ALTER TABLE si.app_user ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE si.app_user ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE si.app_user ADD COLUMN IF NOT EXISTS wajib_ganti_sandi boolean NOT NULL DEFAULT true;
ALTER TABLE si.app_user ADD COLUMN IF NOT EXISTS gagal_login smallint NOT NULL DEFAULT 0;
ALTER TABLE si.app_user ADD COLUMN IF NOT EXISTS kunci_sampai timestamptz;
ALTER TABLE si.app_user ADD COLUMN IF NOT EXISTS sesi_versi integer NOT NULL DEFAULT 1;
ALTER TABLE si.app_user ADD COLUMN IF NOT EXISTS login_terakhir timestamptz;
ALTER TABLE si.app_user ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE si.app_user ALTER COLUMN role DROP NOT NULL;
COMMENT ON TABLE si.app_user IS 'Akun & peran pengguna Ruang Data. Kata sandi disimpan sebagai hash bcrypt.';
CREATE TABLE IF NOT EXISTS si.audit_log (
  id bigserial PRIMARY KEY,
  waktu timestamptz NOT NULL DEFAULT now(),
  user_id uuid, email text, tabel text NOT NULL, aksi text NOT NULL, record_key text, data jsonb
);
COMMENT ON TABLE si.audit_log IS 'Jejak perubahan data dan pengguna (dicatat otomatis oleh API).';
CREATE INDEX IF NOT EXISTS ix_audit_log_waktu ON si.audit_log (waktu DESC);
COMMIT;
