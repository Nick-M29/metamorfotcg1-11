const pool = require('../config/db');

/**
 * Reglas centrales de XP. TODA modificacion de xp / xp_historical
 * de un usuario debe pasar por aqui para mantener la logica en un solo sitio:
 *
 *  - Ganar XP (evento, torneo)      -> sube xp Y xp_historical
 *  - Perder XP (no asistir, perder) -> baja xp, NUNCA xp_historical, nunca por debajo de 0
 *  - Gastar XP (canje de recompensa)-> baja xp, NUNCA xp_historical, nunca por debajo de 0
 */

// Suma XP ganado (evento, torneo, etc). Afecta a xp y a xp_historical.
async function addXp(client, userId, amount) {
  if (amount <= 0) return;
  await client.query(
    `UPDATE users
     SET xp = xp + $1, xp_historical = xp_historical + $1
     WHERE id = $2`,
    [amount, userId]
  );
}

// Resta XP como penalizacion (no-show, derrota). Solo afecta a xp, nunca al historico.
async function penalizeXp(client, userId, amount) {
  if (amount <= 0) return;
  await client.query(
    `UPDATE users
     SET xp = GREATEST(xp - $1, 0)
     WHERE id = $2`,
    [amount, userId]
  );
}

// Gasta XP en la tienda de recompensas. Solo afecta a xp, nunca al historico.
// Lanza un error si el usuario no tiene suficiente XP disponible.
async function spendXp(client, userId, amount) {
  const { rows } = await client.query('SELECT xp FROM users WHERE id = $1 FOR UPDATE', [userId]);
  if (rows.length === 0) throw new Error('Usuario no encontrado');
  if (rows[0].xp < amount) throw new Error('XP insuficiente para este canje');

  await client.query('UPDATE users SET xp = xp - $1 WHERE id = $2', [amount, userId]);
}

// Comprueba si `userId` (un referido) debe disparar el bono de +1 XP a quien lo invito.
// Regla: si el referido consigue XP dentro de su primer mes desde el registro,
// su referente gana +1 XP permanente (una sola vez). Si pasa el mes sin que el
// referido consiga XP, el bono queda cerrado para siempre (no se paga).
// Debe llamarse SIEMPRE despues de un addXp real a `userId` (ganancia genuina de XP,
// no penalizaciones ni gastos).
async function maybeAwardReferralBonus(client, userId) {
  const { rows } = await client.query(
    'SELECT referred_by, referral_bonus_paid, created_at FROM users WHERE id = $1 FOR UPDATE',
    [userId]
  );
  if (rows.length === 0) return;
  const { referred_by, referral_bonus_paid, created_at } = rows[0];

  if (!referred_by || referral_bonus_paid) return;

  const { rows: windowRows } = await client.query(
    "SELECT (NOW() <= $1::timestamp + INTERVAL '1 month') AS within_window",
    [created_at]
  );

  // Cerramos el flag siempre: o bien porque ya se paga el bono, o porque expiro sin pagarlo.
  if (windowRows[0].within_window) {
    await addXp(client, referred_by, 1);
  }
  await client.query('UPDATE users SET referral_bonus_paid = TRUE WHERE id = $1', [userId]);
}

module.exports = { addXp, penalizeXp, spendXp, maybeAwardReferralBonus };
