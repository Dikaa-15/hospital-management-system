const { verifyCredentials } = require('./auth.service');
const { logAuditEvent } = require('../audit/audit.service');

async function renderLogin(req, res) {
  return res.render('pages/auth/sign-in', {
    title: 'Login HMS',
    error: req.query.error || ''
  });
}

async function login(req, res) {
  const identifier = (req.body.identifier || req.body.email || '').trim();
  const password = req.body.password || '';

  if (!identifier || !password) {
    await logAuditEvent({
      action: 'auth.login.failed',
      objectType: 'auth',
      metadata: { reason: 'missing_credentials', identifier }
    });
    return res.redirect('/login?error=Email/username dan password wajib diisi');
  }

  try {
    const user = await verifyCredentials(identifier, password);
    if (!user) {
      await logAuditEvent({
        action: 'auth.login.failed',
        objectType: 'auth',
        metadata: { reason: 'invalid_credentials', identifier }
      });
      return res.redirect('/login?error=Kredensial tidak valid');
    }

    req.session.user = user;
    await logAuditEvent({
      actorUserId: user.id,
      action: 'auth.login.success',
      objectType: 'auth',
      metadata: { role: user.role, identifier }
    });
    return res.redirect('/dashboard');
  } catch (error) {
    await logAuditEvent({
      action: 'auth.login.error',
      objectType: 'auth',
      metadata: { reason: error.message, identifier }
    });
    return res.redirect('/login?error=Gagal login, coba lagi');
  }
}

function logout(req, res) {
  const actorUserId = req.session.user?.id || null;
  req.session.destroy(() => {
    void logAuditEvent({
      actorUserId,
      action: 'auth.logout',
      objectType: 'auth'
    });
    res.redirect('/login');
  });
}

module.exports = { renderLogin, login, logout };
