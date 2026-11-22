import { Pool, types } from 'pg';

// DATE → string 'YYYY-MM-DD' (tanpa geser zona waktu); NUMERIC → number
types.setTypeParser(1082, (v: string) => v);
types.setTypeParser(1700, (v: string) => (v === null ? null : Number(v)));
types.setTypeParser(20, (v: string) => Number(v));

const g = globalThis as unknown as { __rdPool?: Pool };

export function pool(): Pool {
  if (!g.__rdPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL belum diatur');
    const local = /localhost|127\.0\.0\.1|\/tmp\//.test(url);
    g.__rdPool = new Pool({
      connectionString: url,
      max: Number(process.env.PG_POOL_MAX || 3),
      idleTimeoutMillis: 10_000,
      ssl: local ? undefined : { rejectUnauthorized: false },
    });
  }
  return g.__rdPool;
}
