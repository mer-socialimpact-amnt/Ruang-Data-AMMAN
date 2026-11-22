import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function supabaseServer() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) { return store.get(name)?.value; },
      set(name: string, value: string, options: CookieOptions) { try { store.set({ name, value, ...options }); } catch { /* dipanggil dari Server Component */ } },
      remove(name: string, options: CookieOptions) { try { store.set({ name, value: '', ...options }); } catch { /* idem */ } },
    },
  });
}
