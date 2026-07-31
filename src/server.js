const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const tcgsRoutes = require('./routes/tcgs.routes');
const eventsRoutes = require('./routes/events.routes');
const rewardsRoutes = require('./routes/rewards.routes');

const app = express();

// Nos aseguramos de que exista la carpeta donde se guardan las imagenes subidas
fs.mkdirSync(path.join(__dirname, '..', 'public', 'uploads'), { recursive: true });

app.use(cors());
app.use(express.json());

// API
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tcgs', tcgsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/rewards', rewardsRoutes);

// Frontend estatico (HTML + JS + CSS + imagenes subidas)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Manejador de errores: convierte errores de multer (tamaño/formato de imagen) y
// otros errores no controlados en una respuesta JSON en lugar de HTML.
app.use((err, req, res, next) => {
  if (err) {
    console.error(err);
    return res.status(400).json({ error: err.message || 'Error al procesar la peticion' });
  }
  next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
