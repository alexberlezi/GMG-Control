import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth/session';

export default async function HomePage() {
  // Check if system is installed (DB truth, not cookie)
  const isInstalled = await db.systemConfig.findUnique({
    where: { key: 'setup_complete' },
  }).catch(() => null);

  if (!isInstalled) {
    redirect('/setup');
  }

  // Check if user has valid session
  const session = await validateSession();

  if (session) {
    redirect('/dashboard');
  }

  redirect('/login');
}
