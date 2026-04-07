const authService = require('../services/auth.service');
const { commonErrorHandler } = require('../utils/errorHandler');
const { runController } = require('../helpers/controller.helper');

function redirectToGithub(req, res, next) {
  authService.redirectToGithub(req, res, next);
}

function handleGithubCallback(req, res) {
  try {
    if (!req.user) {
      return commonErrorHandler(
        req,
        res,
        'OAuth completed without a user profile',
        500,
        new Error('req.user missing after GitHub OAuth')
      );
    }

    const url = authService.buildOAuthSuccessRedirectUrl(req.user);
    res.redirect(url);
  } catch (error) {
    return commonErrorHandler(
      req,
      res,
      error.message,
      error.statusCode || 500,
      error
    );
  }
}

function githubAuthFailed(req, res) {
  const { message, statusCode } = authService.getGithubOAuthFailurePayload();
  return commonErrorHandler(req, res, message, statusCode, null);
}

async function getMe(req, res) {
  return runController(req, res, {
    run: () => authService.getProfileForAuthUser(req.user.id),
  });
}

module.exports = {
  redirectToGithub,
  handleGithubCallback,
  githubAuthFailed,
  getMe,
};
