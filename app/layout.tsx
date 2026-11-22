import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ruang Data · Social Impact AMMAN',
  description: 'Satu Ruang, Beragam Data — master data peserta Social Impact AMMAN',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
