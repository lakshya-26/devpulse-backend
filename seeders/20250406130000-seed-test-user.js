'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up() {
    const { User, Streak } = require('../models');

    const [user] = await User.findOrCreate({
      where: { githubId: '12345678' },
      defaults: {
        username: 'testdev',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
        email: 'testdev@example.com',
        accessToken: 'gho_test_placeholder',
      },
    });

    await Streak.findOrCreate({
      where: { userId: user.id },
      defaults: {
        currentStreak: 0,
        longestStreak: 0,
        lastActiveDate: null,
      },
    });
  },

  async down() {
    const { User } = require('../models');
    await User.destroy({ where: { githubId: '12345678' }, force: true });
  },
};
