import { TwoFactorForm } from './two-factor-form';
import { AuthLayoutRenderer } from '@/components/auth/auth-layout-renderer';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function TwoFactorPage() {
  const cookieStore = await cookies();
  const preAuthToken = cookieStore.get('preAuthToken')?.value;

  if (!preAuthToken) {
    redirect('/login?error=invalid_token');
  }

  let themeConfig = await db.themeConfig.findFirst();
  if (!themeConfig) {
    themeConfig = await db.themeConfig.create({ data: {} });
  }

  return (
    <AuthLayoutRenderer theme={themeConfig}>
      <TwoFactorForm />
    </AuthLayoutRenderer>
  );
}
