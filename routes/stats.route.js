const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const statsController = require('../controllers/stats.controller');
const statsValidator = require('../validators/stats.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/commits', statsValidator.commitsQuery, statsController.getCommits);
router.get('/contributions', statsValidator.contributionsQuery, statsController.getContributions);
router.get('/prs', statsValidator.prsQuery, statsController.getPrs);
router.get('/repos', statsValidator.reposQuery, statsController.getRepos);
router.get('/compare', statsValidator.compareQuery, statsController.getCompare);
router.get('/streak', statsController.getStreak);
router.get('/languages', statsController.getLanguages);
router.post('/refresh', statsController.refreshCache);

module.exports = router;
