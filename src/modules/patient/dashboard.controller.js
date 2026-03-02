const {
  resolvePatientByUser,
  getPatientLatestVitals,
  getPatientNextAppointment,
  getPatientRecentActivities,
  getPatientAppointments,
  getPatientMedicalRecords,
  getPatientPrescriptions,
  getPatientBilling,
  getDoctorOptionsForBooking,
  createPatientAppointment,
  getAvailableSlots,
  updatePatientAppointment
} = require('./dashboard.service');

function formatTimeAgo(dateValue) {
  if (!dateValue) return '-';
  const diffMs = Date.now() - new Date(dateValue).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
}

async function renderPatientOverview(req, res) {
  const userId = req.session.user?.id;

  try {
    const patient = await resolvePatientByUser(userId);
    if (!patient) {
      return res.render('pages/dashboard-patients/overview', {
        title: 'Patient Overview',
        user: req.session.user,
        baseHref: '/templates/dashboard-patients/',
        pageError: 'Patient profile not found.',
        patientData: null,
        activities: []
      });
    }

    const [vitals, nextAppointment, recentActivities] = await Promise.all([
      getPatientLatestVitals(patient.id),
      getPatientNextAppointment(patient.id),
      getPatientRecentActivities(patient.id)
    ]);

    const patientName = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'Patient';
    return res.render('pages/dashboard-patients/overview', {
      title: 'Patient Overview',
      user: req.session.user,
      baseHref: '/templates/dashboard-patients/',
      pageError: '',
      patientData: {
        id: patient.id,
        medicalRecordNumber: patient.medical_record_number || '-',
        firstName: patient.first_name || 'Patient',
        fullName: patientName,
        bloodType: 'N/A',
        weightKg: Number(vitals?.weight_kg || 0),
        heightCm: Number(vitals?.height_cm || 0),
        heartRate: Number(vitals?.heart_rate || 0),
        systolicBp: Number(vitals?.systolic_bp || 0),
        diastolicBp: Number(vitals?.diastolic_bp || 0),
        nextAppointment: nextAppointment
          ? {
              doctorName: nextAppointment.doctor_name || 'Doctor',
              specialization: nextAppointment.specialization || 'General Physician',
              visitDate: nextAppointment.visit_date
            }
          : null
      },
      activities: (recentActivities || []).map((item, idx) => ({
        title: item.title,
        description: item.description,
        timeAgo: formatTimeAgo(item.activity_at),
        tone: ['green', 'blue', 'purple'][idx % 3]
      }))
    });
  } catch (error) {
    return res.render('pages/dashboard-patients/overview', {
      title: 'Patient Overview',
      user: req.session.user,
      baseHref: '/templates/dashboard-patients/',
      pageError: `Failed to load patient dashboard: ${error.message}`,
      patientData: null,
      activities: []
    });
  }
}

function toPatientBase(patient) {
  if (!patient) return null;
  return {
    id: patient.id,
    fullName: [patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'Patient',
    firstName: patient.first_name || 'Patient',
    medicalRecordNumber: patient.medical_record_number || '-'
  };
}

function formatMoney(n) {
  return `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
}

async function renderPatientAppointments(req, res) {
  const userId = req.session.user?.id;
  try {
    const patient = await resolvePatientByUser(userId);
    if (!patient) throw new Error('Patient profile not found');
    const [rows, doctorRows] = await Promise.all([getPatientAppointments(patient.id), getDoctorOptionsForBooking()]);
    const now = Date.now();
    const mapped = rows.map((r) => ({
      id: r.id,
      doctorId: r.doctor_id,
      doctorName: r.doctor_name || 'Doctor',
      specialization: r.specialization || 'General',
      visitDate: new Date(r.visit_date),
      status: r.status || 'Antre'
    }));

    return res.render('pages/dashboard-patients/my-appointments', {
      title: 'My Appointments',
      user: req.session.user,
      baseHref: '/templates/dashboard-patients/',
      pageError: '',
      patientData: toPatientBase(patient),
      upcomingAppointments: mapped.filter((x) => x.visitDate.getTime() >= now),
      historyAppointments: mapped.filter((x) => x.visitDate.getTime() < now),
      doctorOptions: (doctorRows || []).map((d) => ({
        id: d.id,
        name: d.doctor_name,
        spec: d.specialization,
        img: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=80&h=80&fit=crop&crop=face',
        available: true
      }))
    });
  } catch (error) {
    return res.render('pages/dashboard-patients/my-appointments', {
      title: 'My Appointments',
      user: req.session.user,
      baseHref: '/templates/dashboard-patients/',
      pageError: `Failed to load appointments: ${error.message}`,
      patientData: null,
      upcomingAppointments: [],
      historyAppointments: [],
      doctorOptions: []
    });
  }
}

async function handleCreatePatientAppointment(req, res) {
  const userId = req.session.user?.id;
  try {
    const patient = await resolvePatientByUser(userId);
    if (!patient) {
      return res.status(404).json({ ok: false, message: 'Patient profile not found' });
    }

    const doctorId = String(req.body.doctor_id || '').trim();
    const bookingDate = String(req.body.booking_date || '').trim();
    const bookingTime = String(req.body.booking_time || '').trim();
    if (!doctorId || !bookingDate || !bookingTime) {
      return res.status(400).json({ ok: false, message: 'Doctor, date, and time are required' });
    }
    const doctorOptions = await getDoctorOptionsForBooking();
    const validDoctor = doctorOptions.some((d) => d.id === doctorId);
    if (!validDoctor) {
      return res.status(400).json({ ok: false, message: 'Selected doctor is invalid' });
    }

    const visitDateTime = `${bookingDate} ${bookingTime}:00`;
    await createPatientAppointment(patient.id, { doctorId, visitDateTime });
    return res.json({ ok: true, message: 'Appointment booked' });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
}

async function handleGetPatientAvailableSlots(req, res) {
  try {
    const doctorId = String(req.query.doctor_id || '').trim();
    const bookingDate = String(req.query.date || '').trim();
    const excludeId = String(req.query.exclude_id || '').trim();
    if (!doctorId || !bookingDate) {
      return res.status(400).json({ ok: false, message: 'Doctor and date are required' });
    }

    const slots = await getAvailableSlots(doctorId, bookingDate, excludeId);
    return res.json({ ok: true, slots });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
}

async function handleReschedulePatientAppointment(req, res) {
  const userId = req.session.user?.id;
  try {
    const patient = await resolvePatientByUser(userId);
    if (!patient) return res.status(404).json({ ok: false, message: 'Patient profile not found' });

    const appointmentId = String(req.params.id || '').trim();
    const doctorId = String(req.body.doctor_id || '').trim();
    const bookingDate = String(req.body.booking_date || '').trim();
    const bookingTime = String(req.body.booking_time || '').trim();
    if (!appointmentId || !doctorId || !bookingDate || !bookingTime) {
      return res.status(400).json({ ok: false, message: 'Doctor, date, and time are required' });
    }

    const slots = await getAvailableSlots(doctorId, bookingDate, appointmentId);
    const requested = slots.find((s) => s.time === bookingTime);
    if (!requested || !requested.available) {
      return res.status(400).json({ ok: false, message: 'Selected slot is no longer available' });
    }

    const visitDateTime = `${bookingDate} ${bookingTime}:00`;
    await updatePatientAppointment(patient.id, appointmentId, { doctorId, visitDateTime });
    return res.json({ ok: true, message: 'Appointment rescheduled' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message });
  }
}

async function renderPatientMedicalRecords(req, res) {
  const userId = req.session.user?.id;
  try {
    const patient = await resolvePatientByUser(userId);
    if (!patient) throw new Error('Patient profile not found');
    const rows = await getPatientMedicalRecords(patient.id);
    return res.render('pages/dashboard-patients/medical-records', {
      title: 'Medical Records',
      user: req.session.user,
      baseHref: '/templates/dashboard-patients/',
      pageError: '',
      patientData: toPatientBase(patient),
      recordsData: rows
    });
  } catch (error) {
    return res.render('pages/dashboard-patients/medical-records', {
      title: 'Medical Records',
      user: req.session.user,
      baseHref: '/templates/dashboard-patients/',
      pageError: `Failed to load records: ${error.message}`,
      patientData: null,
      recordsData: []
    });
  }
}

async function renderPatientPrescriptions(req, res) {
  const userId = req.session.user?.id;
  try {
    const patient = await resolvePatientByUser(userId);
    if (!patient) throw new Error('Patient profile not found');
    const rows = await getPatientPrescriptions(patient.id);
    return res.render('pages/dashboard-patients/prescriptions', {
      title: 'Prescriptions',
      user: req.session.user,
      baseHref: '/templates/dashboard-patients/',
      pageError: '',
      patientData: toPatientBase(patient),
      prescriptionData: rows
    });
  } catch (error) {
    return res.render('pages/dashboard-patients/prescriptions', {
      title: 'Prescriptions',
      user: req.session.user,
      baseHref: '/templates/dashboard-patients/',
      pageError: `Failed to load prescriptions: ${error.message}`,
      patientData: null,
      prescriptionData: []
    });
  }
}

async function renderPatientBilling(req, res) {
  const userId = req.session.user?.id;
  try {
    const patient = await resolvePatientByUser(userId);
    if (!patient) throw new Error('Patient profile not found');
    const rows = await getPatientBilling(patient.id);
    const outstanding = rows.reduce((s, x) => s + Math.max(0, Number(x.net_amount || 0) - Number(x.paid_amount || 0)), 0);
    const deposit = 0;
    const latest = rows[0] || null;
    return res.render('pages/dashboard-patients/billing', {
      title: 'Billing & Payments',
      user: req.session.user,
      baseHref: '/templates/dashboard-patients/',
      pageError: '',
      patientData: toPatientBase(patient),
      billingData: rows,
      billingSummary: {
        outstanding: formatMoney(outstanding),
        deposit: formatMoney(deposit),
        savings: formatMoney(rows.reduce((s, x) => s + Number(x.discount_amount || 0), 0))
      },
      selectedInvoice: latest
        ? {
            invoiceNo: latest.invoice_no,
            createdAt: new Date(latest.created_at),
            consultation: formatMoney(Number(latest.total_amount || 0) * 0.55),
            lab: formatMoney(Number(latest.total_amount || 0) * 0.25),
            medication: formatMoney(Number(latest.total_amount || 0) * 0.15),
            admin: formatMoney(Number(latest.total_amount || 0) * 0.05),
            total: formatMoney(latest.net_amount || 0)
          }
        : null
    });
  } catch (error) {
    return res.render('pages/dashboard-patients/billing', {
      title: 'Billing & Payments',
      user: req.session.user,
      baseHref: '/templates/dashboard-patients/',
      pageError: `Failed to load billing: ${error.message}`,
      patientData: null,
      billingData: [],
      billingSummary: { outstanding: 'Rp 0', deposit: 'Rp 0', savings: 'Rp 0' },
      selectedInvoice: null
    });
  }
}

module.exports = {
  renderPatientOverview,
  renderPatientAppointments,
  renderPatientMedicalRecords,
  renderPatientPrescriptions,
  renderPatientBilling,
  handleCreatePatientAppointment,
  handleGetPatientAvailableSlots,
  handleReschedulePatientAppointment
};
