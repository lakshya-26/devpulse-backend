const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config/env');
const { CustomException } = require('../utils/errorHandler');

function assertJwtConfigured() {
  if (!jwtConfig.secret) {
    throw CustomException('JWT is not configured', 500);
  }
}

/** @param {{ id: string, username?: string | null, email?: string | null, avatarUrl?: string | null }} user */
function signAccessToken(user) {
  assertJwtConfigured();
  return jwt.sign(
    {
      sub: user.id,
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn }
  );
}

module.exports = { signAccessToken };
