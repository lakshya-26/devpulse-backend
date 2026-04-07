const Redis = require('ioredis');
const { redisUrl } = require('./env');

const redis = new Redis(redisUrl);

redis.on('connect', () => {});
redis.on('error', () => {});

module.exports = redis;
