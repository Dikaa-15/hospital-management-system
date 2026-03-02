const {
  getDoctorProfile,
  getDoctorMetrics,
  getDoctorExtraStats,
  getDoctorPatientDirectory,
  createDoctorPatient,
  updateDoctorPatient,
  deleteDoctorPatient,
  getDoctorPatientsLookup,
  getDoctorAppointments,
  createDoctorAppointment,
  updateDoctorAppointmentStatus,
  getDoctorShifts,
  createDoctorShift,
  updateDoctorShift,
  deleteDoctorShift,
  getDoctorReportSummary,
  getDoctorSettings,
  getSpecializationOptions,
  updateDoctorSettingsProfile,
  updateDoctorSettingsPassword,
  getRecentPatients,
  getTodaySchedule,
  getWeeklyChart,
  getDepartmentOverview
} = require('./dashboard.service');

const CHART_COLORS = ['#4ade80', '#2dd4bf', '#4ade80', '#1e3a5f', '#2dd4bf', '#4ade80', '#94a3b8'];
const DEPT_COLORS = ['#4ade80', '#2dd4bf', '#1e3a5f', '#f59e0b', '#60a5fa'];

function toISODate(value) {
  if (!value) return '';
  return new Date(value).toISOString().slice(0, 10);
}

function mapPatients(patients) {
  return patients.map((p) => ({
    name: p.patient_name,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face',
    condition: p.condition_code || 'N/A',
    lastVisit: toISODate(p.visit_date),
    status: p.status === 'Monitoring' ? 'monitoring' : p.status === 'Waiting' ? 'critical' : 'stable'
  }));
}

function mapSchedule(todaySchedule) {
  const now = new Date();
  return todaySchedule.slice(0, 5).map((s) => {
    const t = new Date(s.visit_date);
    const diff = t.getTime() - now.getTime();
    let status = 'upcoming';
    if (diff < -30 * 60 * 1000) status = 'past';
    else if (Math.abs(diff) <= 30 * 60 * 1000) status = 'current';

    const admissionType = (s.admission_type || '').toLowerCase();
    let type = 'checkup';
    if (admissionType.includes('igd')) type = 'consultation';
    if (admissionType.includes('inap')) type = 'followup';

    return {
      time: t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      patient: s.patient_name,
      type,
      status
    };
  });
}

function mapDepartments(departments) {
  return departments.map((d, idx) => ({
    name: d.name,
    patients: d.total,
    capacity: d.max,
    color: DEPT_COLORS[idx % DEPT_COLORS.length]
  }));
}

function buildChartData(chartByPeriod) {
  const mapSeries = (series) =>
    (series?.labels || []).map((label, idx) => ({
      label,
      value: Number(series?.data?.[idx] || 0),
      color: CHART_COLORS[idx % CHART_COLORS.length]
    }));

  return {
    week: mapSeries(chartByPeriod?.week),
    month: mapSeries(chartByPeriod?.month),
    year: mapSeries(chartByPeriod?.year)
  };
}

function getEmptyChartData() {
  return {
    week: [
      { label: 'Mon', value: 0, color: CHART_COLORS[0] },
      { label: 'Tue', value: 0, color: CHART_COLORS[1] },
      { label: 'Wed', value: 0, color: CHART_COLORS[2] },
      { label: 'Thu', value: 0, color: CHART_COLORS[3] },
      { label: 'Fri', value: 0, color: CHART_COLORS[4] },
      { label: 'Sat', value: 0, color: CHART_COLORS[5] },
      { label: 'Sun', value: 0, color: CHART_COLORS[6] }
    ],
    month: [
      { label: 'W1', value: 0, color: CHART_COLORS[0] },
      { label: 'W2', value: 0, color: CHART_COLORS[1] },
      { label: 'W3', value: 0, color: CHART_COLORS[2] },
      { label: 'W4', value: 0, color: CHART_COLORS[3] }
    ],
    year: [
      { label: 'Q1', value: 0, color: CHART_COLORS[0] },
      { label: 'Q2', value: 0, color: CHART_COLORS[1] },
      { label: 'Q3', value: 0, color: CHART_COLORS[2] },
      { label: 'Q4', value: 0, color: CHART_COLORS[3] }
    ]
  };
}

function formatVisitDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function mapPatientStatus(encounterStatus) {
  if (encounterStatus === 'Selesai') return 'recovered';
  if (encounterStatus === 'Antre') return 'check-up';
  return 'in-treatment';
}

function toFeetInches(heightCm) {
  const cm = Number(heightCm || 0);
  if (!cm) return '-';
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function buildHeartRateSeries(hr) {
  const base = Number(hr || 72);
  return [base - 2, base, base + 1, base - 1, base, base + 2, base - 1, base].map((n) => Math.max(50, n));
}

function mapDoctorPatients(rows) {
  return rows.map((r) => {
    const age = r.date_of_birth ? Math.max(0, Math.floor((Date.now() - new Date(r.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))) : 0;
    const tempF = Number(r.temp_celcius || 0) > 0 ? ((Number(r.temp_celcius) * 9) / 5 + 32).toFixed(1) : '98.6';
    const weightLbs = Number(r.weight_kg || 0) > 0 ? Math.round(Number(r.weight_kg) * 2.20462) : 0;
    const displayName = [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || 'Unknown Patient';
    const code = r.medical_record_number || String(r.patient_uuid || '').slice(0, 8).toUpperCase();

    return {
      id: r.patient_uuid,
      mrn: code,
      name: displayName,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=face',
      age,
      gender: r.gender || '-',
      dob: r.date_of_birth ? new Date(r.date_of_birth).toISOString().slice(0, 10) : '',
      lastVisit: formatVisitDate(r.visit_date),
      diagnosis: r.diagnosis || 'N/A',
      status: mapPatientStatus(r.encounter_status),
      phone: r.phone_number || '',
      email: r.email || '',
      address: r.address || '',
      bloodType: 'Unknown',
      allergies: ['No known allergies'],
      vitals: {
        heartRate: buildHeartRateSeries(r.heart_rate),
        bloodPressure: { systolic: Number(r.systolic_bp || 120), diastolic: Number(r.diastolic_bp || 80) },
        temperature: Number(tempF),
        weight: weightLbs || 0,
        height: toFeetInches(r.height_cm)
      },
      notes: r.clinical_plan || 'No recent clinical notes.'
    };
  });
}

function mapAppointmentStatus(row) {
  if (row.status === 'Selesai') return 'completed';
  if (row.status === 'Pemeriksaan') return 'in-progress';
  if (row.status === 'Farmasi') return 'confirmed';
  const visitTs = new Date(row.visit_date).getTime();
  return visitTs > Date.now() ? 'pending' : 'waiting';
}

function formatTimeRange(dateValue) {
  const start = new Date(dateValue);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  return {
    time: start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    endTime: end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  };
}

function mapAppointments(rows) {
  return rows.map((r) => {
    const range = formatTimeRange(r.visit_date);
    return {
      id: r.id,
      patientId: r.patient_id,
      patientName: r.patient_name || 'Unknown Patient',
      patientCode: r.medical_record_number || String(r.patient_id || '').slice(0, 8).toUpperCase(),
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face',
      time: range.time,
      endTime: range.endTime,
      duration: 30,
      reason: r.admission_type || 'General consultation',
      status: mapAppointmentStatus(r),
      type: (r.admission_type || 'Consultation').toLowerCase(),
      date: new Date(r.visit_date).toISOString()
    };
  });
}

function mapShiftTypeToBlock(shiftType) {
  if (shiftType === 'Night') return { startHour: 18, endHour: 20, type: 'vip', title: 'Night Shift' };
  if (shiftType === 'Afternoon') return { startHour: 13, endHour: 17, type: 'practice', title: 'Afternoon Shift' };
  return { startHour: 8, endHour: 12, type: 'practice', title: 'Morning Shift' };
}

function mapDoctorShifts(rows) {
  const toYmd = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value.slice(0, 10);
    const d = new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return rows.map((r) => {
    const cfg = mapShiftTypeToBlock(r.shift_type);
    return {
      id: r.id,
      shiftDate: toYmd(r.shift_date),
      shiftType: r.shift_type,
      department: r.department || '',
      startHour: cfg.startHour,
      endHour: cfg.endHour,
      type: cfg.type,
      title: r.department || cfg.title,
      location: r.notes || 'Hospital',
      notes: r.notes || ''
    };
  });
}

function mapReportTrend(rows) {
  if (!rows.length) {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month) => ({
      month,
      cardiology: 0,
      general: 0,
      emergency: 0
    }));
  }
  return rows.map((r) => ({
    month: r.month_label,
    cardiology: Number(r.cardiology || 0),
    general: Number(r.general || 0),
    emergency: Number(r.emergency || 0)
  }));
}

function mapReportTable(rows) {
  return rows.map((r) => ({
    name: r.report_name,
    category: r.category,
    date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '-',
    status: r.status === 'ready' ? 'ready' : 'pending'
  }));
}

function mapDemographics(data) {
  const age18_30 = Number(data.age_18_30 || 0);
  const age31_50 = Number(data.age_31_50 || 0);
  const age51_65 = Number(data.age_51_65 || 0);
  const age66Plus = Number(data.age_66_plus || 0);
  const total = age18_30 + age31_50 + age51_65 + age66Plus;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  return {
    total,
    groups: [
      { label: '18-30 years', value: age18_30, pct: pct(age18_30), color: '#4ade80' },
      { label: '31-50 years', value: age31_50, pct: pct(age31_50), color: '#2dd4bf' },
      { label: '51-65 years', value: age51_65, pct: pct(age51_65), color: '#1e3a5f' },
      { label: '65+ years', value: age66Plus, pct: pct(age66Plus), color: '#94a3b8' }
    ]
  };
}

async function renderDoctorDashboard(req, res) {
  const doctorId = req.session.user?.id;

  try {
    const [doctorProfile, metrics, doctorExtra, patients, todaySchedule, weeklyChart, departments] = await Promise.all([
      getDoctorProfile(doctorId),
      getDoctorMetrics(doctorId),
      getDoctorExtraStats(doctorId),
      getRecentPatients(doctorId),
      getTodaySchedule(doctorId),
      getWeeklyChart(doctorId),
      getDepartmentOverview()
    ]);

    return res.render('pages/dashboard-docter/dashboard', {
      title: 'Doctor Dashboard',
      user: req.session.user,
      doctorProfile,
      doctorExtra,
      metrics,
      chartData: buildChartData(weeklyChart),
      patientsData: mapPatients(patients),
      scheduleData: mapSchedule(todaySchedule),
      departmentsData: mapDepartments(departments),
      counterTargets: {
        patientCount: Number(metrics.patient_count || 0),
        appointmentCount: Number(metrics.appointment_today || 0),
        surgeryCount: Number(metrics.inpatient_cases || 0)
      },
      todayLabel: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      pageError: '',
      baseHref: '/templates/dashboard-docter/'
    });
  } catch (error) {
    return res.render('pages/dashboard-docter/dashboard', {
      title: 'Doctor Dashboard',
      user: req.session.user,
      doctorProfile: null,
      doctorExtra: {
        revenueMonth: 0,
        revenuePrev: 0,
        growthPct: 0,
        completionRate: 0,
        bedsOccupied: 0,
        criticalPatients: 0
      },
      metrics: { patient_count: 0, appointment_today: 0, inpatient_cases: 0, active_queue: 0 },
      chartData: getEmptyChartData(),
      patientsData: [],
      scheduleData: [],
      departmentsData: [],
      counterTargets: { patientCount: 0, appointmentCount: 0, surgeryCount: 0 },
      todayLabel: new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }),
      pageError: `Failed to load dashboard data: ${error.message}`,
      baseHref: '/templates/dashboard-docter/'
    });
  }
}

async function renderDoctorPatients(req, res) {
  const doctorId = req.session.user?.id;
  try {
    const rows = await getDoctorPatientDirectory(doctorId);
    return res.render('pages/dashboard-docter/patiensts', {
      title: 'Doctor Patients',
      user: req.session.user,
      patientsData: mapDoctorPatients(rows),
      baseHref: '/templates/dashboard-docter/'
    });
  } catch (error) {
    return res.render('pages/dashboard-docter/patiensts', {
      title: 'Doctor Patients',
      user: req.session.user,
      patientsData: [],
      pageError: `Failed to load patients: ${error.message}`,
      baseHref: '/templates/dashboard-docter/'
    });
  }
}

async function renderDoctorAppointments(req, res) {
  const doctorId = req.session.user?.id;
  try {
    const [appointmentRows, patientRows] = await Promise.all([
      getDoctorAppointments(doctorId),
      getDoctorPatientsLookup(doctorId)
    ]);

    return res.render('pages/dashboard-docter/appointments', {
      title: 'Doctor Appointments',
      user: req.session.user,
      appointmentsData: mapAppointments(appointmentRows),
      patientOptions: patientRows.map((p) => ({
        id: p.id,
        name: p.patient_name,
        code: p.medical_record_number || String(p.id || '').slice(0, 8).toUpperCase()
      })),
      baseHref: '/templates/dashboard-docter/'
    });
  } catch (error) {
    return res.render('pages/dashboard-docter/appointments', {
      title: 'Doctor Appointments',
      user: req.session.user,
      appointmentsData: [],
      patientOptions: [],
      pageError: `Failed to load appointments: ${error.message}`,
      baseHref: '/templates/dashboard-docter/'
    });
  }
}

async function renderDoctorSchedules(req, res) {
  const doctorId = req.session.user?.id;
  const now = new Date();
  const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  try {
    const shifts = await getDoctorShifts(doctorId);
    return res.render('pages/dashboard-docter/schedules', {
      title: 'Doctor Schedule',
      user: req.session.user,
      scheduleData: mapDoctorShifts(shifts),
      todayYmd,
      baseHref: '/templates/dashboard-docter/'
    });
  } catch (error) {
    return res.render('pages/dashboard-docter/schedules', {
      title: 'Doctor Schedule',
      user: req.session.user,
      scheduleData: [],
      pageError: `Failed to load schedule: ${error.message}`,
      todayYmd,
      baseHref: '/templates/dashboard-docter/'
    });
  }
}

async function renderDoctorReports(req, res) {
  const doctorId = req.session.user?.id;
  try {
    const summary = await getDoctorReportSummary(doctorId);
    const total = Number(summary.kpi.total_consultations || 0);
    const completed = Number(summary.kpi.completed_consultations || 0);
    const recoveryRate = total ? Number(((completed / total) * 100).toFixed(1)) : 0;
    const demographics = mapDemographics(summary.demographic);

    return res.render('pages/dashboard-docter/reports', {
      title: 'Doctor Reports',
      user: req.session.user,
      baseHref: '/templates/dashboard-docter/',
      pageError: '',
      reportKpi: {
        totalConsultations: total,
        recoveryRate,
        avgConsultationMin: Number(summary.kpi.avg_consultation_min || 0),
        pendingReports: Number(summary.kpi.pending_reports || 0)
      },
      trendData: mapReportTrend(summary.trendRows),
      reportRows: mapReportTable(summary.reportRows),
      demographics
    });
  } catch (error) {
    return res.render('pages/dashboard-docter/reports', {
      title: 'Doctor Reports',
      user: req.session.user,
      baseHref: '/templates/dashboard-docter/',
      pageError: `Failed to load reports: ${error.message}`,
      reportKpi: { totalConsultations: 0, recoveryRate: 0, avgConsultationMin: 0, pendingReports: 0 },
      trendData: [],
      reportRows: [],
      demographics: { total: 0, groups: [] }
    });
  }
}

async function renderDoctorSettings(req, res) {
  const doctorId = req.session.user?.id;
  const activeTab = (req.query.tab || 'profile').toLowerCase();
  const flash = req.query.flash || '';
  const error = req.query.error || '';

  try {
    const [settings, specializations] = await Promise.all([
      getDoctorSettings(doctorId),
      getSpecializationOptions()
    ]);

    const firstName = settings?.first_name || req.session.user?.fullName || 'Doctor';
    const lastName = settings?.last_name || '';
    const displayName = [settings?.title_prefix || 'Dr.', firstName, lastName].filter(Boolean).join(' ').trim();

    return res.render('pages/dashboard-docter/settings', {
      title: 'Doctor Settings',
      user: req.session.user,
      baseHref: '/templates/dashboard-docter/',
      activeTab,
      flash,
      pageError: error,
      settingsProfile: {
        firstName,
        lastName,
        displayName,
        email: settings?.email || req.session.user?.email || '',
        phoneNumber: settings?.phone_number || '',
        titlePrefix: settings?.title_prefix || 'Dr.',
        employeeId: settings?.employee_id || '-',
        specializationId: settings?.specialization_id || '',
        specializationName: settings?.specialization_name || 'General'
      },
      specializationOptions: specializations || []
    });
  } catch (err) {
    return res.render('pages/dashboard-docter/settings', {
      title: 'Doctor Settings',
      user: req.session.user,
      baseHref: '/templates/dashboard-docter/',
      activeTab,
      flash: '',
      pageError: `Failed to load settings: ${err.message}`,
      settingsProfile: {
        firstName: 'Doctor',
        lastName: '',
        displayName: 'Dr. Doctor',
        email: req.session.user?.email || '',
        phoneNumber: '',
        titlePrefix: 'Dr.',
        employeeId: '-',
        specializationId: '',
        specializationName: 'General'
      },
      specializationOptions: []
    });
  }
}

async function handleUpdateDoctorSettingsProfile(req, res) {
  const doctorId = req.session.user?.id;
  const firstName = (req.body.first_name || '').trim();
  const lastName = (req.body.last_name || '').trim();
  const titlePrefix = (req.body.title_prefix || '').trim();
  const phoneNumber = (req.body.phone_number || '').trim();
  const email = (req.body.email || '').trim();
  const specializationId = (req.body.specialization_id || '').trim();

  if (!firstName) {
    return res.redirect('/doctor/settings?tab=profile&error=First%20name%20is%20required');
  }

  try {
    await updateDoctorSettingsProfile(doctorId, {
      firstName,
      lastName,
      titlePrefix,
      phoneNumber,
      email,
      specializationId
    });

    req.session.user = {
      ...req.session.user,
      fullName: [firstName, lastName].filter(Boolean).join(' ').trim() || firstName,
      email: email || req.session.user?.email || ''
    };

    return res.redirect('/doctor/settings?tab=profile&flash=Profile%20updated');
  } catch (error) {
    return res.redirect(`/doctor/settings?tab=profile&error=${encodeURIComponent(error.message)}`);
  }
}

async function handleUpdateDoctorSettingsPassword(req, res) {
  const doctorId = req.session.user?.id;
  const currentPassword = (req.body.current_password || '').trim();
  const newPassword = (req.body.new_password || '').trim();
  const confirmPassword = (req.body.confirm_password || '').trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.redirect('/doctor/settings?tab=security&error=All%20password%20fields%20are%20required');
  }
  if (newPassword.length < 8) {
    return res.redirect('/doctor/settings?tab=security&error=New%20password%20must%20be%20at%20least%208%20characters');
  }
  if (newPassword !== confirmPassword) {
    return res.redirect('/doctor/settings?tab=security&error=Password%20confirmation%20does%20not%20match');
  }

  try {
    await updateDoctorSettingsPassword(doctorId, {
      currentPassword,
      newPassword
    });
    return res.redirect('/doctor/settings?tab=security&flash=Password%20updated');
  } catch (error) {
    return res.redirect(`/doctor/settings?tab=security&error=${encodeURIComponent(error.message)}`);
  }
}

async function handleCreateDoctorPatient(req, res) {
  const doctorId = req.session.user?.id;
  const firstName = (req.body.first_name || '').trim();
  const dateOfBirth = (req.body.date_of_birth || '').trim();
  if (!firstName || !dateOfBirth) {
    return res.status(400).json({ ok: false, message: 'First name and date of birth are required' });
  }

  try {
    await createDoctorPatient(doctorId, {
      medicalRecordNumber: (req.body.medical_record_number || '').trim(),
      firstName,
      lastName: (req.body.last_name || '').trim(),
      gender: (req.body.gender || '').trim(),
      dateOfBirth,
      phoneNumber: (req.body.phone_number || '').trim(),
      email: (req.body.email || '').trim(),
      address: (req.body.address || '').trim()
    });

    return res.json({ ok: true, message: 'Patient created' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message });
  }
}

async function handleUpdateDoctorPatient(req, res) {
  const doctorId = req.session.user?.id;
  const patientId = req.params.id;
  const firstName = (req.body.first_name || '').trim();
  const dateOfBirth = (req.body.date_of_birth || '').trim();
  if (!firstName || !dateOfBirth) {
    return res.status(400).json({ ok: false, message: 'First name and date of birth are required' });
  }

  try {
    await updateDoctorPatient(doctorId, patientId, {
      firstName,
      lastName: (req.body.last_name || '').trim(),
      gender: (req.body.gender || '').trim(),
      dateOfBirth,
      phoneNumber: (req.body.phone_number || '').trim(),
      email: (req.body.email || '').trim(),
      address: (req.body.address || '').trim()
    });
    return res.json({ ok: true, message: 'Patient updated' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message });
  }
}

async function handleDeleteDoctorPatient(req, res) {
  const doctorId = req.session.user?.id;
  const patientId = req.params.id;

  try {
    await deleteDoctorPatient(doctorId, patientId);
    return res.json({ ok: true, message: 'Patient archived' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message });
  }
}

async function handleCreateDoctorAppointment(req, res) {
  const doctorId = req.session.user?.id;
  const patientId = (req.body.patient_id || '').trim();
  const visitDate = (req.body.visit_date || '').trim();
  if (!patientId || !visitDate) {
    return res.status(400).json({ ok: false, message: 'Patient and date-time are required' });
  }

  try {
    await createDoctorAppointment(doctorId, {
      patientId,
      visitDate,
      admissionType: (req.body.admission_type || '').trim()
    });
    return res.json({ ok: true, message: 'Appointment created' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message });
  }
}

async function handleUpdateDoctorAppointmentStatus(req, res) {
  const doctorId = req.session.user?.id;
  const appointmentId = req.params.id;
  const action = (req.body.action || '').trim();
  const actionToStatus = {
    start: 'Pemeriksaan',
    complete: 'Selesai',
    confirm: 'Farmasi',
    reset: 'Antre'
  };
  const nextStatus = actionToStatus[action];
  if (!nextStatus) {
    return res.status(400).json({ ok: false, message: 'Invalid action' });
  }

  try {
    await updateDoctorAppointmentStatus(doctorId, appointmentId, nextStatus);
    return res.json({ ok: true, message: 'Appointment status updated' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message });
  }
}

async function handleCreateDoctorShift(req, res) {
  const doctorId = req.session.user?.id;
  const shiftDate = (req.body.shift_date || '').trim();
  const shiftType = (req.body.shift_type || '').trim();
  if (!shiftDate || !shiftType) {
    return res.status(400).json({ ok: false, message: 'Shift date and type are required' });
  }

  try {
    await createDoctorShift(doctorId, {
      shiftDate,
      shiftType,
      department: (req.body.department || '').trim(),
      notes: (req.body.notes || '').trim()
    });
    return res.json({ ok: true, message: 'Shift created' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message });
  }
}

async function handleDeleteDoctorShift(req, res) {
  const doctorId = req.session.user?.id;
  try {
    await deleteDoctorShift(doctorId, req.params.id);
    return res.json({ ok: true, message: 'Shift deleted' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message });
  }
}

async function handleUpdateDoctorShift(req, res) {
  const doctorId = req.session.user?.id;
  const shiftDate = (req.body.shift_date || '').trim();
  const shiftType = (req.body.shift_type || '').trim();
  if (!shiftDate || !shiftType) {
    return res.status(400).json({ ok: false, message: 'Shift date and type are required' });
  }

  try {
    await updateDoctorShift(doctorId, req.params.id, {
      shiftDate,
      shiftType,
      department: (req.body.department || '').trim(),
      notes: (req.body.notes || '').trim()
    });
    return res.json({ ok: true, message: 'Shift updated' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ ok: false, message: error.message });
  }
}

module.exports = {
  renderDoctorDashboard,
  renderDoctorPatients,
  renderDoctorAppointments,
  renderDoctorSchedules,
  renderDoctorReports,
  handleCreateDoctorPatient,
  handleUpdateDoctorPatient,
  handleDeleteDoctorPatient,
  handleCreateDoctorAppointment,
  handleUpdateDoctorAppointmentStatus,
  handleCreateDoctorShift,
  handleUpdateDoctorShift,
  handleDeleteDoctorShift,
  renderDoctorSettings,
  handleUpdateDoctorSettingsProfile,
  handleUpdateDoctorSettingsPassword
};
