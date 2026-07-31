const pool = require('../config/db');
const { publicPath } = require('../middleware/upload.middleware');

// GET /api/tcgs - publico/autenticado, para pintar el checklist de favoritos
async function listTcgs(req, res) {
  try {
    const { rows } = await pool.query('SELECT id, name, image_url FROM tcgs ORDER BY name ASC');
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al listar TCGs' });
  }
}

// POST /api/tcgs (admin) - multipart/form-data: { name, image? }
async function createTcg(req, res) {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'El nombre es obligatorio' });

  const image_url = publicPath('tcgs', req.file);

  try {
    const { rows } = await pool.query(
      'INSERT INTO tcgs (name, image_url) VALUES ($1, $2) RETURNING id, name, image_url',
      [name, image_url]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese TCG ya existe' });
    console.error(err);
    return res.status(500).json({ error: 'Error al crear el TCG' });
  }
}

module.exports = { listTcgs, createTcg };
