const { Pool } = require('pg');
require('dotenv').config();

// Pool unico de conexiones a Postgres, reutilizado por toda la app.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;
