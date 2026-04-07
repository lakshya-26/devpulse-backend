require('dotenv').config();

const { required } = require('./requiredEnv');

function loggingFromEnv() {
  const v = required(
    'SEQUELIZE_LOGGING',
    'Must be exactly "true" or "false" to enable or disable SQL logs'
  );
  if (v !== 'true' && v !== 'false') {
    throw new Error('SEQUELIZE_LOGGING must be exactly "true" or "false"');
  }
  return v === 'true' ? () => {} : false;
}

function parseDbPort() {
  const raw = required('DB_PORT');
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('DB_PORT must be a positive integer');
  }
  return n;
}

function sslOptionsFromEnv() {
  const v = required(
    'DATABASE_SSL',
    'Must be "true" or "false" (use false for local Postgres without TLS)'
  );
  if (v !== 'true' && v !== 'false') {
    throw new Error('DATABASE_SSL must be exactly "true" or "false"');
  }
  return v === 'true'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {};
}

const common = {
  dialect: 'postgres',
};

module.exports = {
  get development() {
    return {
      ...common,
      logging: loggingFromEnv(),
      username: required('DB_USER'),
      password: required('DB_PASSWORD'),
      database: required('DB_NAME'),
      host: required('DB_HOST'),
      port: parseDbPort(),
    };
  },
  get test() {
    return {
      ...common,
      logging: loggingFromEnv(),
      username: required('DB_USER'),
      password: required('DB_PASSWORD'),
      database: required('DB_NAME_TEST'),
      host: required('DB_HOST'),
      port: parseDbPort(),
    };
  },
  get production() {
    return {
      ...common,
      logging: loggingFromEnv(),
      url: required('DATABASE_URL'),
      dialectOptions: sslOptionsFromEnv(),
    };
  },
};
