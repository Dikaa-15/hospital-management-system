function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login?error=Please login first');
  }
  return next();
}

function requireGuest(req, res, next) {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  return next();
}

module.exports = { requireAuth, requireGuest };
