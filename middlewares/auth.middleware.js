const jwt = require('jsonwebtoken');
const { CustomException } = require('../utils/errorHandler');
const { jwt: jwtConfig } = require('../config/env');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(CustomException('No token provided', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, jwtConfig.secret);
    const id = decoded.id ?? decoded.sub;
    req.user = {
      id,
      username: decoded.username,
      email: decoded.email,
      avatarUrl: decoded.avatarUrl,
    };
    next();
  } catch {
    next(CustomException('Invalid or expired token', 401));
  }
}

module.exports = authMiddleware;
