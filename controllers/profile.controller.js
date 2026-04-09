const profileService = require('../services/profile.service');
const { runController } = require('../helpers/controller.helper');

async function getByUsername(req, res) {
  return runController(req, res, {
    run: () => profileService.getPublicProfileByUsername(req.params.username, res),
    message: 'Success',
  });
}

module.exports = {
  getByUsername,
};
