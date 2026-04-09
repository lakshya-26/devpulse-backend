'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('daily_goals', 'target_coding_hours', {
      type: Sequelize.DECIMAL(4, 1),
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('daily_goals', 'target_coding_hours');
  },
};
