const express = require('express');
const router = express.Router();
const tcgsController = require('../controllers/tcgs.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { uploadTo } = require('../middleware/upload.middleware');

const uploadTcgImage = uploadTo('tcgs');

// Publica: la pantalla de registro necesita listar los TCGs antes de tener sesion
router.get('/', tcgsController.listTcgs);
router.post('/', requireAuth, requireRole('admin'), uploadTcgImage.single('image'), tcgsController.createTcg);

module.exports = router;
