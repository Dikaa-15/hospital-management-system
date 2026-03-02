function allowRoles(...roles) {
  return (req, res, next) => {
    const role = String(req.session.user?.role || '').trim().toLowerCase();
    const allowed = roles.map((r) => String(r).trim().toLowerCase());
    if (!role || !allowed.includes(role)) {
      return res.status(403).render('partials/forbidden', {
        title: 'Forbidden'
      });
    }
    return next();
  };
}

module.exports = { allowRoles };
