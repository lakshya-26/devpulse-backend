const express = require('express');
const passport = require('../config/passport');
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/github', authController.redirectToGithub);
router.get(
  '/github/callback',
  passport.authenticate('github', {
    session: false,
    failureRedirect: '/api/v1/auth/failed',
  }),
  authController.handleGithubCallback
);
router.get('/failed', authController.githubAuthFailed);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
