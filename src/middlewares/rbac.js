function allowRoles(...roles) {
  return (req, res, next) => {
    const role = req.session.user?.role;
    if (!role || !roles.includes(role)) {
      return res.status(403).render('partials/forbidden', {
        title: 'Forbidden'
      });
    }
    return next();
  };
}

module.exports = { allowRoles };
