'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('generate_uuid_v4()'),
      },
      github_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      username: Sequelize.STRING,
      avatar_url: Sequelize.TEXT,
      email: Sequelize.STRING,
      access_token: Sequelize.TEXT,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
