'use strict';

const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DailyGoal extends Model {
    static associate(models) {
      DailyGoal.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  DailyGoal.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: sequelize.literal('generate_uuid_v4()'),
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
      },
      targetCommits: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'target_commits',
      },
      targetPrs: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'target_prs',
      },
      date: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'DailyGoal',
      tableName: 'daily_goals',
      underscored: true,
      paranoid: true,
    }
  );

  return DailyGoal;
};
