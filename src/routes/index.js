const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../middlewares/auth');
const { renderDoctorDashboard } = require('../modules/doctor/dashboard.controller');
const { renderPatientOverview } = require('../modules/patient/dashboard.controller');

const router = express.Router();

router.use(require('../modules/auth/auth.routes'));
router.use(require('../modules/admin/users.routes'));
router.use(require('../modules/admin/patients.routes'));
router.use(require('../modules/admin/inventory.routes'));
router.use(require('../modules/admin/finance.routes'));
router.use(require('../modules/admin/schedule.routes'));
router.use(require('../modules/doctor/dashboard.routes'));
router.use(require('../modules/patient/dashboard.routes'));
router.use(require('../modules/system/system.routes'));

router.get('/', (req, res) => {
  return res.render('pages/landing-page', {
    title: 'Hospital Management System',
    user: req.session.user || null,
    baseHref: '/templates/'
  });
});

router.get('/pricing', (req, res) => {
  return res.render('pages/pricing', {
    title: 'Pricing Plans',
    user: req.session.user || null
  });
});

router.get('/dashboard', requireAuth, (req, res) => {
  const role = req.session.user.role;
  if (role === 'doctor') {
    return renderDoctorDashboard(req, res);
  }
  if (role === 'patient') {
    return renderPatientOverview(req, res);
  }

  const viewByRole = {
    admin: {
      view: 'pages/dashboard-admin/dashboard',
      baseHref: '/templates/dashboard-admin/'
    },
    pharmacist: {
      view: 'pages/dashboard-admin/inventory-management',
      baseHref: '/templates/dashboard-admin/'
    }
  };

  const resolved = viewByRole[role];
  if (!resolved) {
    return res.render('dashboards/default', {
      title: 'Dashboard',
      user: req.session.user
    });
  }

  return res.render(resolved.view, {
    title: 'Dashboard',
    user: req.session.user,
    baseHref: resolved.baseHref
  });
});

router.get('/templates/*', (req, res) => {
  const requestedPath = req.params[0] || '';
  if (requestedPath.includes('..')) {
    return res.status(400).send('Invalid path');
  }

  const protectedTemplates = [
    { prefix: 'dashboard-admin/inventory-management', roles: ['admin', 'pharmacist'] },
    { prefix: 'dashboard-admin/', roles: ['admin'] },
    { prefix: 'dashboard-docter/', roles: ['doctor'] },
    { prefix: 'dashboard-patients/', roles: ['patient'] }
  ];
  const matchedRule = protectedTemplates.find((rule) => requestedPath.startsWith(rule.prefix));
  if (matchedRule) {
    if (!req.session.user) {
      return res.redirect('/login?error=Please login first');
    }
    if (!matchedRule.roles.includes(req.session.user.role)) {
      return res.status(403).render('partials/forbidden', {
        title: 'Forbidden'
      });
    }
  }

  const templateView = `pages/${requestedPath.replace(/\.html$/i, '')}`;
  const absoluteViewPath = path.join(__dirname, '..', 'views', `${templateView}.ejs`);
  if (!fs.existsSync(absoluteViewPath)) {
    return res.status(404).send('Template not found');
  }

  return res.render(templateView, {
    title: 'HMS Template',
    user: req.session.user || null
  });
});

module.exports = router;
