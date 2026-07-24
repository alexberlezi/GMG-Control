import 'dotenv/config';
import { db } from '../src/lib/db';

async function main() {
  const orphans = await db.$executeRawUnsafe(`UPDATE "Invite" SET "invitedBy" = NULL WHERE "invitedBy" NOT IN (SELECT id FROM "User")`);
  console.log(`Orphan invites nullified: ${orphans}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
