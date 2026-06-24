const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('connect', async (client) => {
  try {
    await client.query("SET client_encoding TO 'UTF8'");
    console.log('✅ Conectado a PostgreSQL con client_encoding UTF8');
  } catch (err) {
    console.error('❌ Error configurando client_encoding:', err);
  }
});

pool.on('error', (err) => {
  console.error('❌ Error en PostgreSQL:', err);
});

module.exports = pool;