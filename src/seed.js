// Script de arranque inicial (seed): crea el usuario admin y unos TCGs base
// leyendo los datos desde .env. Es seguro ejecutarlo varias veces (idempotente):
// no duplica TCGs y, si el admin ya existe, solo se asegura de que su rol sea 'admin'.
//
// Uso: npm run seed

const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = require('./config/db');
const { generateInvitationCode } = require('./utils/code.util');

const STARTER_TCGS = ['Magic: The Gathering', 'Pokémon TCG', 'Yu-Gi-Oh!'];

async function seedTcgs(client) {
  for (const name of STARTER_TCGS) {
    await client.query(
      'INSERT INTO tcgs (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
  }
  console.log(`TCGs base comprobados: ${STARTER_TCGS.join(', ')}`);
}

async function seedAdmin(client) {
  const {
    ADMIN_FIRST_NAME = 'Admin',
    ADMIN_LAST_NAME = 'Principal',
    ADMIN_USERNAME,
    ADMIN_PASSWORD,
  } = process.env;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.log('ADMIN_USERNAME / ADMIN_PASSWORD no definidos en .env, me salto la creacion del admin.');
    return;
  }

  const { rows } = await client.query('SELECT id, role FROM users WHERE username = $1', [ADMIN_USERNAME]);

  if (rows.length > 0) {
    // Ya existe: nos aseguramos de que sea admin, pero NO tocamos su contraseña actual.
    if (rows[0].role !== 'admin') {
      await client.query("UPDATE users SET role = 'admin' WHERE id = $1", [rows[0].id]);
      console.log(`Usuario '${ADMIN_USERNAME}' ya existia, actualizado a rol admin.`);
    } else {
      console.log(`Usuario admin '${ADMIN_USERNAME}' ya existia. Nada que hacer.`);
    }
    return;
  }

  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  let invitationCode;
  let unique = false;
  while (!unique) {
    invitationCode = generateInvitationCode();
    const check = await client.query('SELECT 1 FROM users WHERE invitation_code = $1', [invitationCode]);
    unique = check.rows.length === 0;
  }

  await client.query(
    `INSERT INTO users (first_name, last_name, username, password_hash, role, invitation_code)
     VALUES ($1, $2, $3, $4, 'admin', $5)`,
    [ADMIN_FIRST_NAME, ADMIN_LAST_NAME, ADMIN_USERNAME, password_hash, invitationCode]
  );

  console.log(`Usuario admin '${ADMIN_USERNAME}' creado correctamente.`);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await seedTcgs(client);
    await seedAdmin(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error al ejecutar el seed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
