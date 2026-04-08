const express = require('express');
const profileController = require('../controllers/profile.controller');
const profileValidator = require('../validators/profile.validator');

const router = express.Router();

router.get('/:username', profileValidator.usernameParam, profileController.getByUsername);

module.exports = router;
