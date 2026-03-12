const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { allowRoles } = require('../../middlewares/rbac');
const {
  renderDoctorDashboard,
  renderDoctorPatients,
  renderDoctorAppointments,
  handleExportDoctorAppointments,
  renderDoctorSchedules,
  renderDoctorReports,
  renderDoctorSettings,
  handleCreateDoctorPatient,
  handleUpdateDoctorPatient,
  handleUpdateDoctorPatientClinical,
  handleDeleteDoctorPatient,
  handleExportDoctorPatients,
  handleCreateDoctorAppointment,
  handleUpdateDoctorAppointmentStatus,
  handleCreateDoctorShift,
  handleUpdateDoctorShift,
  handleDeleteDoctorShift,
  handleUpdateDoctorSettingsProfile,
  handleUpdateDoctorSettingsPassword
} = require('./dashboard.controller');

const router = express.Router();

router.get('/templates/dashboard-docter/dashboard', requireAuth, allowRoles('doctor'), renderDoctorDashboard);
router.get('/templates/dashboard-docter/dashboard.html', requireAuth, allowRoles('doctor'), renderDoctorDashboard);
router.get('/templates/dashboard-docter/patiensts', requireAuth, allowRoles('doctor'), renderDoctorPatients);
router.get('/templates/dashboard-docter/patiensts.html', requireAuth, allowRoles('doctor'), renderDoctorPatients);
router.get('/doctor/patients', requireAuth, allowRoles('doctor'), renderDoctorPatients);
router.get('/doctor/patients/export', requireAuth, allowRoles('doctor'), handleExportDoctorPatients);
router.get('/templates/dashboard-docter/appointments', requireAuth, allowRoles('doctor'), renderDoctorAppointments);
router.get('/templates/dashboard-docter/appointments.html', requireAuth, allowRoles('doctor'), renderDoctorAppointments);
router.get('/doctor/appointments', requireAuth, allowRoles('doctor'), renderDoctorAppointments);
router.get('/doctor/appointments/export', requireAuth, allowRoles('doctor'), handleExportDoctorAppointments);
router.get('/templates/dashboard-docter/schedules', requireAuth, allowRoles('doctor'), renderDoctorSchedules);
router.get('/templates/dashboard-docter/schedules.html', requireAuth, allowRoles('doctor'), renderDoctorSchedules);
router.get('/doctor/schedules', requireAuth, allowRoles('doctor'), renderDoctorSchedules);
router.get('/templates/dashboard-docter/reports', requireAuth, allowRoles('doctor'), renderDoctorReports);
router.get('/templates/dashboard-docter/reports.html', requireAuth, allowRoles('doctor'), renderDoctorReports);
router.get('/doctor/reports', requireAuth, allowRoles('doctor'), renderDoctorReports);
router.get('/templates/dashboard-docter/settings', requireAuth, allowRoles('doctor'), renderDoctorSettings);
router.get('/templates/dashboard-docter/settings.html', requireAuth, allowRoles('doctor'), renderDoctorSettings);
router.get('/doctor/settings', requireAuth, allowRoles('doctor'), renderDoctorSettings);
router.post('/doctor/patients', requireAuth, allowRoles('doctor'), handleCreateDoctorPatient);
router.post('/doctor/patients/:id/update', requireAuth, allowRoles('doctor'), handleUpdateDoctorPatient);
router.post('/doctor/patients/:id/clinical', requireAuth, allowRoles('doctor'), handleUpdateDoctorPatientClinical);
router.post('/doctor/patients/:id/delete', requireAuth, allowRoles('doctor'), handleDeleteDoctorPatient);
router.post('/doctor/appointments', requireAuth, allowRoles('doctor'), handleCreateDoctorAppointment);
router.post('/doctor/appointments/:id/status', requireAuth, allowRoles('doctor'), handleUpdateDoctorAppointmentStatus);
router.post('/doctor/schedules', requireAuth, allowRoles('doctor'), handleCreateDoctorShift);
router.post('/doctor/schedules/:id/update', requireAuth, allowRoles('doctor'), handleUpdateDoctorShift);
router.post('/doctor/schedules/:id/delete', requireAuth, allowRoles('doctor'), handleDeleteDoctorShift);
router.post('/doctor/settings/profile', requireAuth, allowRoles('doctor'), handleUpdateDoctorSettingsProfile);
router.post('/doctor/settings/password', requireAuth, allowRoles('doctor'), handleUpdateDoctorSettingsPassword);

module.exports = router;
