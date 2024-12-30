const { Client } = require('pg');

const pgConfig = {
  user: "ferre",
  host: "localhost",
  database: "gis",
  password: "wachtwoord",
  port: 5432, // default port for PostgreSQL
};

const client = new Client(pgConfig);

async function dropTables() {
  try {
    await client.connect();
    await client.query('DROP TABLE IF EXISTS gemeente;');
    await client.query('DROP TABLE IF EXISTS knooppunt;');
    console.log('Tables dropped successfully');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

dropTables();