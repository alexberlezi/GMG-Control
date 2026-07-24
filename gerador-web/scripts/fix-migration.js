const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/authforge_dev' });
client.connect()
  .then(() => client.query(`DELETE FROM "_prisma_migrations" WHERE "migration_name" = '20260721094719_post_audit_hardening'`))
  .then((res) => {
    console.log(`Deleted ${res.rowCount} rows from _prisma_migrations`);
    client.end();
  })
  .catch(err => {
    console.error(err);
    client.end();
    process.exit(1);
  });
