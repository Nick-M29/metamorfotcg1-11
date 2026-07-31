const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'public', 'uploads');

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

// Crea (si hace falta) y devuelve un middleware de multer que guarda imagenes
// en public/uploads/<folder>/ con un nombre unico. Sirve para tcgs, productos y avatares.
function uploadTo(folder) {
  const dest = path.join(UPLOADS_ROOT, folder);
  fs.mkdirSync(dest, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      const unique = crypto.randomBytes(8).toString('hex');
      cb(null, `${Date.now()}-${unique}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new Error('Formato de imagen no soportado (usa png, jpg, webp o gif)'));
      }
      cb(null, true);
    },
  });
}

// Convierte el archivo subido (si lo hay) en la ruta publica que se guarda en BD.
function publicPath(folder, file) {
  if (!file) return null;
  return `/uploads/${folder}/${file.filename}`;
}

module.exports = { uploadTo, publicPath };
