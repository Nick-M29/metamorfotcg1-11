const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { generateInvitationCode } = require('../utils/code.util');
require('dotenv').config();

// POST /api/auth/register
// body: { first_name, last_name, username, password, tcg_ids: [1,2], invitation_code_used?: 'ABC123' }
async function register(req, res) {
  const { first_name, last_name, username, password, tcg_ids = [], invitation_code_used } = req.body;

  if (!first_name || !last_name || !username || !password) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Si viene un codigo de invitacion, lo validamos primero
    let referrer = null;
    if (invitation_code_used) {
      const { rows } = await client.query(
        'SELECT id FROM users WHERE invitation_code = $1',
        [invitation_code_used]
      );
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Codigo de invitacion no valido' });
      }
      referrer = rows[0];
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Generamos un codigo de invitacion propio y unico para el nuevo usuario
    let ownCode;
    let unique = false;
    while (!unique) {
      ownCode = generateInvitationCode();
      const { rows } = await client.query('SELECT 1 FROM users WHERE invitation_code = $1', [ownCode]);
      unique = rows.length === 0;
    }

    // Usuario nuevo: rol 'client', xp 0, xp_historical 0, is_buyer false (todo por defecto en la tabla)
    const insertUser = await client.query(
      `INSERT INTO users (first_name, last_name, username, password_hash, invitation_code, referred_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, first_name, last_name, username, role, is_buyer, xp, xp_historical, invitation_code`,
      [first_name, last_name, username, password_hash, ownCode, referrer ? referrer.id : null]
    );
    const newUser = insertUser.rows[0];

    // Guardamos sus TCGs favoritos
    for (const tcgId of tcg_ids) {
      await client.query(
        'INSERT INTO user_tcgs (user_id, tcg_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [newUser.id, tcgId]
      );
    }

    // Si venia de una invitacion, incrementamos el contador del que invita
    if (referrer) {
      await client.query(
        'UPDATE users SET referral_count = referral_count + 1 WHERE id = $1',
        [referrer.id]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({ user: newUser });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al registrar el usuario' });
  } finally {
    client.release();
  }
}

// POST /api/auth/login
// body: { username, password }
async function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        role: user.role,
        is_buyer: user.is_buyer,
        xp: user.xp,
        xp_historical: user.xp_historical,
        invitation_code: user.invitation_code,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al iniciar sesion' });
  }
}

module.exports = { register, login };
