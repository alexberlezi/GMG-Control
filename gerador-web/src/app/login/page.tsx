import { LoginForm } from '@/components/auth/login-form';
import { AuthLayoutRenderer } from '@/components/auth/auth-layout-renderer';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Verify setup is complete — if DB was reset, redirect to setup
  const setupComplete = await db.systemConfig.findUnique({
    where: { key: 'setup_complete' },
  });

  if (!setupComplete) {
    redirect('/setup');
  }

  // Get current auth configurations
  let authConfig = await db.authConfig.findFirst();
  if (!authConfig) {
    authConfig = await db.authConfig.create({ data: {} });
  }

  // Get current theme configurations
  let themeConfig = await db.themeConfig.findFirst();
  if (!themeConfig) {
    themeConfig = await db.themeConfig.create({ data: {} });
  }

  return (
    <AuthLayoutRenderer theme={themeConfig}>
      <LoginForm authConfig={authConfig} />
    </AuthLayoutRenderer>
  );
}
