import bcrypt from 'bcryptjs';

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const checkPassword = (pw: string, hash: string | null) => (hash ? bcrypt.compare(pw, hash) : Promise.resolve(false));
// Hash tiruan agar waktu respons sama untuk email yang tidak terdaftar
export const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO3VRS0J2nLAVxb3c5aAbOyw1z5Yb1bTa';

export function validateNewPassword(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'Kata sandi minimal 8 karakter.';
  if (pw.length > 72) return 'Kata sandi maksimal 72 karakter.';
  return null;
}
