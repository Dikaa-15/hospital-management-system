const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { allowRoles } = require('../../middlewares/rbac');
const {
  renderPatientDirectory,
  handleCreatePatient,
  handleUpdatePatient,
  handlePatientStatus
} = require('./patients.controller');

const router = express.Router();

router.get('/templates/dashboard-admin/patient-directory.html', requireAuth, allowRoles('admin'), renderPatientDirectory);
router.post('/admin/patients', requireAuth, allowRoles('admin'), handleCreatePatient);
router.post('/admin/patients/:id/update', requireAuth, allowRoles('admin'), handleUpdatePatient);
router.post('/admin/patients/:id/status', requireAuth, allowRoles('admin'), handlePatientStatus);

module.exports = router;
