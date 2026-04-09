require('dotenv').config();

const { required } = require('./requiredEnv');

const nodeEnv = required('NODE_ENV');
const portRaw = required('PORT');
const port = Number(portRaw);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error('PORT must be a positive integer');
}

module.exports = {
  nodeEnv,
  port,
  clientUrl: required('CLIENT_URL', 'Frontend origin, e.g. http://localhost:5173'),
  github: {
    clientId: required('GITHUB_CLIENT_ID'),
    clientSecret: required('GITHUB_CLIENT_SECRET'),
    callbackUrl: required(
      'GITHUB_CALLBACK_URL',
      `Must match GitHub OAuth app callback, e.g. http://localhost:${port}/api/v1/auth/github/callback`
    ),
  },
  githubApi: required('GITHUB_API', 'Usually https://api.github.com'),
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: required('JWT_EXPIRES_IN', 'e.g. 7d'),
  },
  session: {
    secret: required('SESSION_SECRET', 'Use a long random string; distinct from JWT_SECRET is fine'),
  },
  redisUrl: required('REDIS_URL'),
};
