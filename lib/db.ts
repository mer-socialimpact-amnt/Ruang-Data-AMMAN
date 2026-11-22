import { Pool, types } from 'pg';

// DATE → string 'YYYY-MM-DD' (tanpa geser zona waktu); NUMERIC → number
types.setTypeParser(1082, (v: string) => v);
types.setTypeParser(1700, (v: string) => (v === null ? null : Number(v)));
types.setTypeParser(20, (v: string) => Number(v));

const g = globalThis as unknown as { __rdPool?: Pool };

/** Koneksi ke Neon (pooled). SSL diwajibkan kecuali database lokal. */
export function pool(): Pool {
  if (!g.__rdPool) {
    const raw = process.env.DATABASE_URL;
    if (!raw) throw new Error('DATABASE_URL belum diatur');
    const local = /@(localhost|127\.0\.0\.1)[:/]|host=\/tmp/.test(raw);
    // Parameter SSL dari URL diatur lewat opsi `ssl` agar perilakunya sama di semua versi driver.
    const url = raw.replace(/([?&])(sslmode|channel_binding)=[^&]*&?/g, '$1').replace(/[?&]$/, '');
    g.__rdPool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      ssl: local ? undefined : { rejectUnauthorized: true },
    });
  }
  return g.__rdPool;
}
