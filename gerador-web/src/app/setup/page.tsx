import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import { SetupWizard } from '@/components/setup/setup-wizard';

export default async function SetupPage() {
  // Check if already setup
  const isSetup = await db.systemConfig.findUnique({
    where: { key: 'setup_complete' },
  }).catch(() => null);

  if (isSetup) {
    redirect('/login');
  }

  return <SetupWizard />;
}
