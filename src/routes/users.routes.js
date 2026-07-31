const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { uploadTo } = require('../middleware/upload.middleware');

const uploadAvatarImage = uploadTo('avatars');

router.get('/me', requireAuth, usersController.getProfile);
router.post('/me/avatar', requireAuth, uploadAvatarImage.single('avatar'), usersController.uploadAvatar);
router.get('/', requireAuth, requireRole('admin'), usersController.listUsers);
router.patch('/:id/buyer-status', requireAuth, requireRole('admin'), usersController.setBuyerStatus);
router.post('/:id/grant-xp', requireAuth, requireRole('admin'), usersController.grantXp);

module.exports = router;
