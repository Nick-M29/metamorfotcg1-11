const pool = require('../config/db');
const xpService = require('../services/xp.service');
const { publicPath } = require('../middleware/upload.middleware');

// GET /api/rewards - catalogo de productos activos
async function listProducts(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT rp.*, t.name AS tcg_name
       FROM reward_products rp
       JOIN tcgs t ON t.id = rp.tcg_id
       WHERE rp.is_active = TRUE
       ORDER BY rp.price_xp ASC`
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al listar recompensas' });
  }
}

// POST /api/rewards (admin) - multipart/form-data: { name, tcg_id, expansion_set, rarity, price_xp, stock, image? }
async function createProduct(req, res) {
  const { name, tcg_id, expansion_set, rarity, price_xp, stock = 0 } = req.body;
  if (!name || !tcg_id || !price_xp) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const image_url = publicPath('products', req.file);

  try {
    const { rows } = await pool.query(
      `INSERT INTO reward_products (name, tcg_id, expansion_set, rarity, price_xp, stock, image_url, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [name, tcg_id, expansion_set, rarity, price_xp, stock, image_url, req.user.id]
    );
    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear la recompensa' });
  }
}

// POST /api/rewards/:id/redeem (client)
// body: { quantity }
// Descuenta stock y XP (solo xp, xp_historical queda intacto), y deja constancia
// del canje en reward_orders / reward_order_items.
async function redeemProduct(req, res) {
  const { id } = req.params;
  const quantity = parseInt(req.body.quantity, 10) || 1;
  const userId = req.user.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productRes = await client.query(
      'SELECT * FROM reward_products WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (productRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    const product = productRes.rows[0];

    if (!product.is_active) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Este producto ya no esta disponible' });
    }
    if (product.stock < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Stock insuficiente' });
    }

    const totalXp = product.price_xp * quantity;

    // Lanza si no hay XP suficiente
    await xpService.spendXp(client, userId, totalXp);

    await client.query(
      'UPDATE reward_products SET stock = stock - $1 WHERE id = $2',
      [quantity, id]
    );

    const orderRes = await client.query(
      'INSERT INTO reward_orders (user_id, total_xp_spent) VALUES ($1, $2) RETURNING id',
      [userId, totalXp]
    );
    const orderId = orderRes.rows[0].id;

    await client.query(
      `INSERT INTO reward_order_items (order_id, product_id, quantity, xp_at_claim)
       VALUES ($1, $2, $3, $4)`,
      [orderId, id, quantity, product.price_xp]
    );

    await client.query('COMMIT');
    return res.status(201).json({ message: 'Canje realizado', order_id: orderId, xp_spent: totalXp });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.message === 'XP insuficiente para este canje') {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Error al procesar el canje' });
  } finally {
    client.release();
  }
}

// GET /api/rewards/orders (client) - historial de canjes propios
async function myOrders(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT ro.id, ro.total_xp_spent, ro.created_at,
              json_agg(json_build_object(
                'product_name', rp.name,
                'quantity', roi.quantity,
                'xp_at_claim', roi.xp_at_claim
              )) AS items
       FROM reward_orders ro
       JOIN reward_order_items roi ON roi.order_id = ro.id
       JOIN reward_products rp ON rp.id = roi.product_id
       WHERE ro.user_id = $1
       GROUP BY ro.id
       ORDER BY ro.created_at DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al obtener el historial de canjes' });
  }
}

module.exports = { listProducts, createProduct, redeemProduct, myOrders };
