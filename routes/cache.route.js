const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const cacheController = require('../controllers/cache.controller');

const router = express.Router();

router.get('/stats', authMiddleware, cacheController.getStats);

module.exports = router;
