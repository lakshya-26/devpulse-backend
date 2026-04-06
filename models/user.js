'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.DailyGoal, { foreignKey: 'user_id', as: 'dailyGoals' });
      User.hasOne(models.Streak, { foreignKey: 'user_id', as: 'streak' });
      User.hasMany(models.Session, { foreignKey: 'user_id', as: 'sessions' });
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal('generate_uuid_v4()'),
        primaryKey: true,
      },
      githubId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'github_id',
      },
      username: DataTypes.STRING,
      avatarUrl: {
        type: DataTypes.TEXT,
        field: 'avatar_url',
      },
      email: DataTypes.STRING,
      accessToken: {
        type: DataTypes.TEXT,
        field: 'access_token',
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      underscored: true,
      paranoid: true,
    }
  );

  return User;
};
