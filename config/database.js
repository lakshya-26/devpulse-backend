require('dotenv').config();

const common = {
  dialect: 'postgres',
  logging: process.env.SEQUELIZE_LOGGING === 'true' ? console.log : false,
};

module.exports = {
  development: {
    ...common,
    username: process.env.DB_USER || 'devpulse',
    password: process.env.DB_PASSWORD || 'devpulse',
    database: process.env.DB_NAME || 'devpulse',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
  },
  test: {
    ...common,
    username: process.env.DB_USER || 'devpulse',
    password: process.env.DB_PASSWORD || 'devpulse',
    database: process.env.DB_NAME || 'devpulse_test',
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 5432,
  },
  production: {
    ...common,
    url: process.env.DATABASE_URL,
    dialectOptions:
      process.env.DATABASE_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
  },
};
