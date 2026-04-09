'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION generate_uuid_v4()
      RETURNS uuid
      LANGUAGE sql
      VOLATILE
      PARALLEL SAFE
      AS $fn$
        SELECT gen_random_uuid();
      $fn$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP FUNCTION IF EXISTS generate_uuid_v4();
    `);
  },
};
