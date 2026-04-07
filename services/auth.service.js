const passport = require('passport');
const { User } = require('../models');
const { clientUrl } = require('../config/env');
const { CustomException } = require('../utils/errorHandler');
const { signAccessToken } = require('./token.service');

const GITHUB_OAUTH_SCOPES = ['user:email', 'repo', 'read:user'];

function redirectToGithub(req, res, next) {
  passport.authenticate('github', { scope: GITHUB_OAUTH_SCOPES })(req, res, next);
}

/**
 * @param {{ id: string, username?: string | null, email?: string | null, avatarUrl?: string | null }} user
 */
function buildOAuthSuccessRedirectUrl(user) {
  const cu = String(clientUrl).trim();
  if (!/^https?:\/\//i.test(cu)) {
    throw CustomException(
      'CLIENT_URL must be a full URL to your frontend (e.g. http://localhost:5173)',
      500
    );
  }

  const originBase = new URL(cu).origin;
  const token = signAccessToken(user);
  return `${originBase}/auth/success?token=${encodeURIComponent(token)}`;
}

function getGithubOAuthFailurePayload() {
  return {
    statusCode: 401,
    message: 'GitHub authentication failed',
  };
}

async function getProfileForAuthUser(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'username', 'email', 'avatarUrl', 'createdAt'],
  });
  if (!user) {
    throw CustomException('User not found', 404);
  }
  return { user };
}

module.exports = {
  redirectToGithub,
  buildOAuthSuccessRedirectUrl,
  getGithubOAuthFailurePayload,
  getProfileForAuthUser,
};
