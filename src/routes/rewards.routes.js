const express = require('express');
const router = express.Router();
const rewardsController = require('../controllers/rewards.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/role.middleware');
const { uploadTo } = require('../middleware/upload.middleware');

const uploadProductImage = uploadTo('products');

router.get('/', requireAuth, rewardsController.listProducts);
router.post('/', requireAuth, requireRole('admin'), uploadProductImage.single('image'), rewardsController.createProduct);
router.post('/:id/redeem', requireAuth, rewardsController.redeemProduct);
router.get('/orders/mine', requireAuth, rewardsController.myOrders);

module.exports = router;
