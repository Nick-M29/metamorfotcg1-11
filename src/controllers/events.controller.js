const pool = require('../config/db');
const xpService = require('../services/xp.service');

// POST /api/events (admin)
// body: { title, description, date_realization, max_players, participation_xp, winner_xp, loser_xp, no_show_xp }
async function createEvent(req, res) {
  const {
    title, description, date_realization, max_players,
    participation_xp = 0, winner_xp = 0, loser_xp = 0, no_show_xp = 0,
  } = req.body;

  if (!title || !date_realization || !max_players) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO events
        (title, description, date_realization, max_players, participation_xp, winner_xp, loser_xp, no_show_xp, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [title, description, date_realization, max_players, participation_xp, winner_xp, loser_xp, no_show_xp, req.user.id]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear el evento' });
  }
}

// GET /api/events - listado general (cualquier usuario autenticado)
async function listEvents(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.id) AS current_players
       FROM events e ORDER BY e.date_realization ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al listar eventos' });
  }
}

// GET /api/events/:id/attendees (admin) - para la pantalla de "finalizar evento"
async function listAttendees(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT u.id AS user_id, u.username, ea.attended, ea.is_winner, ea.registered_at
       FROM event_attendees ea
       JOIN users u ON u.id = ea.user_id
       WHERE ea.event_id = $1
       ORDER BY ea.registered_at ASC`,
      [id]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al listar inscritos' });
  }
}

// POST /api/events/:id/register (client) - inscribirse a un torneo
async function registerToEvent(req, res) {
  const { id } = req.params;
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventRes = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [id]);
    if (eventRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    const event = eventRes.rows[0];
    if (event.finalized) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El evento ya ha finalizado' });
    }

    const countRes = await client.query(
      'SELECT COUNT(*)::int AS total FROM event_attendees WHERE event_id = $1',
      [id]
    );
    if (countRes.rows[0].total >= event.max_players) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'El evento ya esta completo' });
    }

    await client.query(
      'INSERT INTO event_attendees (event_id, user_id) VALUES ($1, $2)',
      [id, userId]
    );

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Inscripcion realizada' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya estas inscrito en este evento' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al inscribirse en el evento' });
  } finally {
    client.release();
  }
}

// POST /api/events/:id/finalize (admin)
// body: { results: [ { user_id, attended: true|false, is_winner: true|false } ] }
//
// Reglas de XP aplicadas (ver README para las asunciones tomadas):
//  - attended = false (no se presento estando inscrito) -> resta no_show_xp
//  - attended = true, is_winner = true                  -> suma participation_xp + winner_xp
//  - attended = true, is_winner = false                  -> suma participation_xp, resta loser_xp
async function finalizeEvent(req, res) {
  const { id } = req.params;
  const { results = [] } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const eventRes = await client.query('SELECT * FROM events WHERE id = $1 FOR UPDATE', [id]);
    if (eventRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Evento no encontrado' });
    }
    const event = eventRes.rows[0];
    if (event.finalized) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este evento ya fue finalizado previamente' });
    }

    for (const result of results) {
      const { user_id, attended, is_winner } = result;

      await client.query(
        'UPDATE event_attendees SET attended = $1, is_winner = $2 WHERE event_id = $3 AND user_id = $4',
        [attended, !!is_winner, id, user_id]
      );

      if (!attended) {
        await xpService.penalizeXp(client, user_id, event.no_show_xp);
        continue;
      }

      // Asistio: XP de participacion siempre
      await xpService.addXp(client, user_id, event.participation_xp);

      if (is_winner) {
        await xpService.addXp(client, user_id, event.winner_xp);
      } else {
        await xpService.penalizeXp(client, user_id, event.loser_xp);
      }

      // Si este usuario es un referido y acaba de conseguir XP real, comprobamos
      // si corresponde pagar el bono de +1 XP a quien lo invito.
      await xpService.maybeAwardReferralBonus(client, user_id);
    }

    await client.query('UPDATE events SET finalized = TRUE WHERE id = $1', [id]);

    await client.query('COMMIT');
    return res.json({ message: 'Evento finalizado y XP aplicado' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Error al finalizar el evento' });
  } finally {
    client.release();
  }
}

module.exports = { createEvent, listEvents, listAttendees, registerToEvent, finalizeEvent };
