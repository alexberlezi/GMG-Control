const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres' });
client.connect()
  .then(() => client.query('DROP DATABASE IF EXISTS authforge_shadow'))
  .then(() => client.query('CREATE DATABASE authforge_shadow'))
  .then(() => {
    console.log('Shadow DB created.');
    client.end();
  })
  .catch(err => {
    console.error(err);
    client.end();
    process.exit(1);
  });
