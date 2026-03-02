const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function ensureSessionToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function csrfProtection(req, res, next) {
  const sessionToken = ensureSessionToken(req);
  res.locals.csrfToken = sessionToken;

  if (SAFE_METHODS.has(req.method)) return next();

  const tokenFromBody = req.body?._csrf;
  const tokenFromHeader = req.get('x-csrf-token');
  const providedToken = tokenFromBody || tokenFromHeader;

  if (
    providedToken &&
    providedToken.length === sessionToken.length &&
    crypto.timingSafeEqual(Buffer.from(providedToken), Buffer.from(sessionToken))
  ) {
    return next();
  }

  // Improve auth UX: expired token on login should return to login page with clear message.
  if (req.path === '/login') {
    return res.redirect('/login?error=Session%20expired.%20Please%20try%20again');
  }

  if (req.accepts('html')) {
    return res.status(403).render('partials/forbidden', { title: 'Forbidden' });
  }
  return res.status(403).json({ message: 'Invalid CSRF token' });
}

module.exports = { csrfProtection };
