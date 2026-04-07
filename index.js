require('dotenv').config();
const { port, clientUrl, nodeEnv, session: sessionConfig } = require('./config/env');

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const passport = require('./config/passport');
const { registerRoutes } = require('./routes');
const db = require('./models');
const redis = require('./config/redis');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();

const corsOptions =
  nodeEnv === 'production'
    ? { origin: clientUrl, credentials: true }
    : { origin: true, credentials: true };

app.use(cors(corsOptions));
app.use(express.json());

app.use(
  session({
    secret: sessionConfig.secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: nodeEnv === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'devpulse-backend' });
});

registerRoutes(app);

app.use(errorHandler);

async function main() {
  await redis.ping();
  console.log('Redis: OK');

  await db.sequelize.authenticate();
  console.log('Database: connected');

  app.listen(port, () => {
    console.log(`Server: http://localhost:${port} (${nodeEnv})`);
  });
}

main().catch((err) => {
  console.error('Startup failed:', err?.message || err);
  process.exit(1);
});
