import { destroySession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

export async function POST() {
  await destroySession();
  redirect('/login');
}
