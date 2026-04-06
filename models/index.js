'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(path.join(__dirname, '..', 'config', 'database.js'))[env];

const db = {};

const defineDefaults = {
  underscored: true,
  paranoid: true,
  timestamps: true,
};

let sequelize;
if (config.url) {
  sequelize = new Sequelize(config.url, {
    ...config,
    define: defineDefaults,
  });
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, {
    host: config.host,
    port: config.port,
    dialect: config.dialect,
    logging: config.logging,
    define: defineDefaults,
  });
}

fs.readdirSync(__dirname)
  .filter((file) => {
    return file.indexOf('.') !== 0 && file !== basename && file.endsWith('.js');
  })
  .forEach((file) => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
