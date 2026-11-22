export const PLATFORM_DESC = 'Platform ini dikembangkan untuk pengelolaan dan monitoring data program Social Impact AMMAN yang dirancang untuk mengintegrasikan data penerima manfaat, keikutsertaan program, UMKM, mitra pelaksana, serta capaian sosial dan pembangunan masyarakat ke dalam satu sistem terpusat.';

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rd-login" role="main">
      <div className="lw">
        <div className="lb"><img src="/logo-white.png" alt="AMMAN" width={128} height={48} /></div>
        <div className="lt">
          <h1>Platform Ruang Data</h1>
          <p>{PLATFORM_DESC}</p>
          {children}
        </div>
        <div className="lf2">© 2026 MER and Compliance. All rights reserved.</div>
      </div>
    </div>
  );
}
