import raw from './schema.json';

export type Col = { name: string; typ: string; pk: boolean; fk: string | null; req: boolean; enum: string | null; desc: string; label: string };
export type TableDef = { desc: string; grp: string; label: string; cols: Col[] };
export const SCHEMA = raw as unknown as Record<string, TableDef>;
export const TABLES = Object.keys(SCHEMA);
export const pkOf = (t: string) => SCHEMA[t].cols.filter((c) => c.pk).map((c) => c.name);
export const q = (ident: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(ident)) throw new Error('Identifier tidak valid: ' + ident);
  return '"' + ident + '"';
};

/** Tabel yang hanya boleh diubah admin */
export const ADMIN_TABLES = new Set(['ref_pilihan', 'ref_ppm_area', 'ref_program', 'ref_wilayah', 'asumsi_penghasilan', 'mitra', 'mitra_kontak', 'konversi_program_lama']);
