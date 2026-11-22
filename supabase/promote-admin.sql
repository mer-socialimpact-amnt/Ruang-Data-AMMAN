-- Jadikan pengguna yang SUDAH terdaftar di Supabase Auth sebagai admin.
-- Ganti email di bawah, lalu jalankan di Supabase SQL Editor.
INSERT INTO si.app_user (id, email, nama, role)
SELECT id, email, coalesce(raw_user_meta_data->>'name', email), 'admin'
FROM auth.users WHERE email = 'nama@amman.co.id'
ON CONFLICT (id) DO UPDATE SET role = 'admin', aktif = true;
