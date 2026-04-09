const express = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const reposController = require('../controllers/repos.controller');
const reposValidator = require('../validators/repos.validator');

const router = express.Router();

router.use(authMiddleware);

router.get('/:repoName/stats', reposValidator.repoNameParam, reposController.getRepoStats);

module.exports = router;
