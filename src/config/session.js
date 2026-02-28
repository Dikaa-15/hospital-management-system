const session = require('express-session');

function createSessionStore() {
  const mode = (process.env.SESSION_STORE || 'memory').toLowerCase();
  if (mode !== 'mysql') return null;

  try {
    const MySQLStoreFactory = require('express-mysql-session');
    const MySQLStore = MySQLStoreFactory(session);
    return new MySQLStore({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hms',
      clearExpired: true,
      checkExpirationInterval: 15 * 60 * 1000,
      expiration: Number(process.env.SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 8),
      createDatabaseTable: true
    });
  } catch (error) {
    console.warn('[session] SESSION_STORE=mysql but express-mysql-session is unavailable. Falling back to memory store.');
    return null;
  }
}

function createSessionMiddleware() {
  const maxAge = Number(process.env.SESSION_MAX_AGE_MS || 1000 * 60 * 60 * 8);
  const isProd = process.env.NODE_ENV === 'production';

  return session({
    name: process.env.SESSION_COOKIE_NAME || 'hms.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    store: createSessionStore() || undefined,
    cookie: {
      httpOnly: true,
      sameSite: isProd ? 'strict' : 'lax',
      secure: isProd,
      maxAge
    }
  });
}

module.exports = { createSessionMiddleware };
