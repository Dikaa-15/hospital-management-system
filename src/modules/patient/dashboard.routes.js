const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { allowRoles } = require('../../middlewares/rbac');
const {
  renderPatientOverview,
  renderPatientAppointments,
  renderPatientMedicalRecords,
  renderPatientPrescriptions,
  renderPatientBilling,
  handleCreatePatientAppointment,
  handleGetPatientAvailableSlots,
  handleReschedulePatientAppointment
} = require('./dashboard.controller');

const router = express.Router();

router.get('/patient/overview', requireAuth, allowRoles('patient'), renderPatientOverview);
router.get('/templates/dashboard-patients/overview', requireAuth, allowRoles('patient'), renderPatientOverview);
router.get('/templates/dashboard-patients/overview.html', requireAuth, allowRoles('patient'), renderPatientOverview);
router.get('/patient/appointments', requireAuth, allowRoles('patient'), renderPatientAppointments);
router.get('/templates/dashboard-patients/my-appointments', requireAuth, allowRoles('patient'), renderPatientAppointments);
router.get('/templates/dashboard-patients/my-appointments.html', requireAuth, allowRoles('patient'), renderPatientAppointments);
router.get('/patient/medical-records', requireAuth, allowRoles('patient'), renderPatientMedicalRecords);
router.get('/templates/dashboard-patients/medical-records', requireAuth, allowRoles('patient'), renderPatientMedicalRecords);
router.get('/templates/dashboard-patients/medical-records.html', requireAuth, allowRoles('patient'), renderPatientMedicalRecords);
router.get('/patient/prescriptions', requireAuth, allowRoles('patient'), renderPatientPrescriptions);
router.get('/templates/dashboard-patients/prescriptions', requireAuth, allowRoles('patient'), renderPatientPrescriptions);
router.get('/templates/dashboard-patients/prescriptions.html', requireAuth, allowRoles('patient'), renderPatientPrescriptions);
router.get('/patient/billing', requireAuth, allowRoles('patient'), renderPatientBilling);
router.get('/templates/dashboard-patients/billing', requireAuth, allowRoles('patient'), renderPatientBilling);
router.get('/templates/dashboard-patients/billing.html', requireAuth, allowRoles('patient'), renderPatientBilling);
router.get('/patient/appointments/slots', requireAuth, allowRoles('patient'), handleGetPatientAvailableSlots);
router.post('/patient/appointments', requireAuth, allowRoles('patient'), handleCreatePatientAppointment);
router.post('/patient/appointments/:id/reschedule', requireAuth, allowRoles('patient'), handleReschedulePatientAppointment);

module.exports = router;
