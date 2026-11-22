// Pemuat .env sederhana (tanpa dependensi)
import fs from 'node:fs';
for (const f of ['.env.local', '.env']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
export const directUrl = () => {
  const u = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!u) { console.error('Atur DIRECT_URL di .env.local'); process.exit(1); }
  return u;
};
export const sslFor = (u) => (/localhost|127\.0\.0\.1|\/tmp\//.test(u) ? undefined : { rejectUnauthorized: false });
