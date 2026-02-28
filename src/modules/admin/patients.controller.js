const {
  listPatients,
  getPatientById,
  createPatient,
  updatePatient,
  setPatientActiveState
} = require('./patients.service');

function pickFilters(query) {
  return {
    q: (query.q || '').trim(),
    insurance: (query.insurance || '').trim(),
    status: (query.status || '').trim()
  };
}

async function renderPatientDirectory(req, res) {
  const filters = pickFilters(req.query);

  try {
    const patients = await listPatients(filters);
    const selectedId = (req.query.edit || '').trim();
    const selectedPatient = selectedId
      ? await getPatientById(selectedId)
      : patients[0] || null;

    return res.render('pages/dashboard-admin/patient-directory', {
      title: 'Patient Directory',
      user: req.session.user,
      patients,
      filters,
      selectedPatient,
      flash: req.query.flash || '',
      error: req.query.error || ''
    });
  } catch (error) {
    return res.status(500).render('pages/dashboard-admin/patient-directory', {
      title: 'Patient Directory',
      user: req.session.user,
      patients: [],
      filters,
      selectedPatient: null,
      flash: '',
      error: `Failed to load patients: ${error.message}`
    });
  }
}

async function handleCreatePatient(req, res) {
  const firstName = (req.body.first_name || '').trim();
  const dateOfBirth = (req.body.date_of_birth || '').trim();
  if (!firstName || !dateOfBirth) {
    return res.redirect('/templates/dashboard-admin/patient-directory.html?error=First%20name%20and%20date%20of%20birth%20are%20required');
  }

  try {
    await createPatient({
      medicalRecordNumber: (req.body.medical_record_number || '').trim(),
      firstName,
      lastName: (req.body.last_name || '').trim(),
      gender: (req.body.gender || '').trim(),
      dateOfBirth,
      phoneNumber: (req.body.phone_number || '').trim(),
      email: (req.body.email || '').trim(),
      address: (req.body.address || '').trim(),
      emergencyName: (req.body.emergency_name || '').trim(),
      emergencyPhone: (req.body.emergency_phone || '').trim(),
      insuranceProvider: (req.body.insurance_provider || '').trim(),
      insuranceNumber: (req.body.insurance_number || '').trim()
    });

    return res.redirect('/templates/dashboard-admin/patient-directory.html?flash=Patient created');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/patient-directory.html?error=${encodeURIComponent(error.message)}`);
  }
}

async function handleUpdatePatient(req, res) {
  const patientId = req.params.id;
  const firstName = (req.body.first_name || '').trim();
  const dateOfBirth = (req.body.date_of_birth || '').trim();
  if (!firstName || !dateOfBirth) {
    return res.redirect(`/templates/dashboard-admin/patient-directory.html?error=First%20name%20and%20date%20of%20birth%20are%20required&edit=${patientId}`);
  }

  try {
    await updatePatient(patientId, {
      firstName,
      lastName: (req.body.last_name || '').trim(),
      gender: (req.body.gender || '').trim(),
      dateOfBirth,
      phoneNumber: (req.body.phone_number || '').trim(),
      email: (req.body.email || '').trim(),
      address: (req.body.address || '').trim(),
      emergencyName: (req.body.emergency_name || '').trim(),
      emergencyPhone: (req.body.emergency_phone || '').trim(),
      insuranceProvider: (req.body.insurance_provider || '').trim(),
      insuranceNumber: (req.body.insurance_number || '').trim()
    });

    return res.redirect(`/templates/dashboard-admin/patient-directory.html?flash=Patient updated&edit=${patientId}`);
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/patient-directory.html?error=${encodeURIComponent(error.message)}&edit=${patientId}`);
  }
}

async function handlePatientStatus(req, res) {
  const patientId = req.params.id;
  const nextStatus = req.body.next_status === 'active';

  try {
    await setPatientActiveState(patientId, nextStatus);
    return res.redirect('/templates/dashboard-admin/patient-directory.html?flash=Patient status updated');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/patient-directory.html?error=${encodeURIComponent(error.message)}`);
  }
}

module.exports = {
  renderPatientDirectory,
  handleCreatePatient,
  handleUpdatePatient,
  handlePatientStatus
};
