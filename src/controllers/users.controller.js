const pool = require('../config/db');
const xpService = require('../services/xp.service');
const { publicPath } = require('../middleware/upload.middleware');

// Cuantos XP vale un euro cuando el admin registra una compra manual.
const XP_PER_EURO = 100;

// GET /api/users/me
async function getProfile(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, username, role, is_buyer, avatar_url,
              xp, xp_historical, invitation_code, referral_count, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });

    const tcgs = await pool.query(
      `SELECT t.id, t.name, t.image_url FROM user_tcgs ut
       JOIN tcgs t ON t.id = ut.tcg_id
       WHERE ut.user_id = $1`,
      [req.user.id]
    );

    return res.json({ ...rows[0], favorite_tcgs: tcgs.rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el perfil' });
  }
}

// GET /api/users  (admin) - listado simple para el panel de administracion
async function listUsers(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, username, role, is_buyer, xp, xp_historical, referral_count
       FROM users ORDER BY id ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al listar usuarios' });
  }
}

// PATCH /api/users/:id/buyer-status  (admin)
// body: { is_buyer: true|false }
// Esto simula la confirmacion de una compra real hecha fuera de este sistema.
async function setBuyerStatus(req, res) {
  const { id } = req.params;
  const { is_buyer } = req.body;

  if (typeof is_buyer !== 'boolean') {
    return res.status(400).json({ error: 'is_buyer debe ser true o false' });
  }

  try {
    const { rows } = await pool.query(
      'UPDATE users SET is_buyer = $1 WHERE id = $2 RETURNING id, username, is_buyer',
      [is_buyer, id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al actualizar el estado de comprador' });
  }
}

// POST /api/users/me/avatar - el propio usuario sube su foto de perfil
async function uploadAvatar(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha recibido ninguna imagen' });
  }
  const avatar_url = publicPath('avatars', req.file);

  try {
    const { rows } = await pool.query(
      'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, avatar_url',
      [avatar_url, req.user.id]
    );
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al subir la foto de perfil' });
  }
}

// POST /api/users/:id/grant-xp (admin)
// body: { euros }
// Convierte una compra real en euros a XP (1€ = 100 XP), la acredita como XP
// genuino (afecta a xp y xp_historical) y marca al usuario como comprador verificado.
async function grantXp(req, res) {
  const { id } = req.params;
  const euros = parseFloat(req.body.euros);

  if (!euros || euros <= 0) {
    return res.status(400).json({ error: 'Introduce un importe en euros valido' });
  }

  const xpAmount = Math.round(euros * XP_PER_EURO);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userRes = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [id]);
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    await xpService.addXp(client, id, xpAmount);
    await client.query('UPDATE users SET is_buyer = TRUE WHERE id = $1', [id]);
    await xpService.maybeAwardReferralBonus(client, id);

    await client.query('COMMIT');
    return res.json({ message: `Se han otorgado ${xpAmount} XP (${euros}€ x ${XP_PER_EURO})`, xp_granted: xpAmount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Error al otorgar XP' });
  } finally {
    client.release();
  }
}

module.exports = { getProfile, listUsers, setBuyerStatus, uploadAvatar, grantXp };
