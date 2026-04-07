const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const goalsController = require('../controllers/goals.controller');
const goalsValidator = require('../validators/goals.validator');

const router = express.Router();

router.use(authMiddleware);

router.post('/', goalsValidator.createGoal, goalsController.createGoal);
router.get('/today', goalsController.getToday);
router.get('/history', goalsValidator.historyQuery, goalsController.getHistory);

module.exports = router;
