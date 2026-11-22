import { redirect } from 'next/navigation';
import { getAppUser } from '@/lib/auth';
import RuangDataApp from '@/components/RuangDataApp';
import NoAccess from '@/components/NoAccess';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getAppUser();
  if (!user) redirect('/login');
  if (!user.role) return <NoAccess email={user.email} />;
  if (user.wajib) redirect('/akun/password?wajib=1');
  return <RuangDataApp user={user} />;
}
