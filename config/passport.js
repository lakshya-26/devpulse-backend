const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const { User } = require('../models');
const { github } = require('./env');

passport.use(
  new GitHubStrategy(
    {
      clientID: github.clientId,
      clientSecret: github.clientSecret,
      callbackURL: github.callbackUrl,
      scope: ['user:email', 'repo', 'read:user'],
    },
    async (accessToken, _refreshToken, profile, done) => {
      try {
        const [user, created] = await User.findOrCreate({
          where: { githubId: String(profile.id) },
          defaults: {
            githubId: String(profile.id),
            username: profile.username,
            email: profile.emails?.[0]?.value || null,
            avatarUrl: profile.photos?.[0]?.value || null,
            accessToken,
          },
        });

        if (!created) {
          await user.update({
            accessToken,
            avatarUrl: profile.photos?.[0]?.value || user.avatarUrl,
            username: profile.username || user.username,
            email: profile.emails?.[0]?.value ?? user.email,
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
