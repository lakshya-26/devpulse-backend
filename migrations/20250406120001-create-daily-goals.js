'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('daily_goals', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('generate_uuid_v4()'),
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
      },
      target_commits: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      target_prs: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addConstraint('daily_goals', {
      fields: ['user_id', 'date'],
      type: 'unique',
      name: 'daily_goals_user_id_date_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('daily_goals');
  },
};
