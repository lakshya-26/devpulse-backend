'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Streak extends Model {
    static associate(models) {
      Streak.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  Streak.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal('generate_uuid_v4()'),
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        field: 'user_id',
      },
      currentStreak: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'current_streak',
      },
      longestStreak: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'longest_streak',
      },
      lastActiveDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_active_date',
      },
    },
    {
      sequelize,
      modelName: 'Streak',
      tableName: 'streaks',
      underscored: true,
      paranoid: true,
    }
  );

  return Streak;
};
