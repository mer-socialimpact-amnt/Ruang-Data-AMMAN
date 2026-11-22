import AuthShell from './AuthShell';

export default function NoAccess({ email }: { email: string }) {
  return (
    <AuthShell>
      <form action="/auth/signout" method="post">
        <h2>Akun belum memiliki akses</h2>
        <p className="ls">Akun <b>{email}</b> sudah terdaftar, tetapi belum diberi peran di Ruang Data. Hubungi administrator untuk mendapatkan akses.</p>
        <button className="btn dark" type="submit">Keluar</button>
      </form>
    </AuthShell>
  );
}
