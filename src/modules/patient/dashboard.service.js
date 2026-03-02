const { getPool } = require('../../config/database');
const crypto = require('crypto');

async function getUserIdentity(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, first_name, last_name, email
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function resolvePatientByUser(userId) {
  const pool = getPool();
  const identity = await getUserIdentity(userId);

  if (identity?.email) {
    const [byEmail] = await pool.execute(
      `SELECT *
       FROM patients
       WHERE deleted_at IS NULL AND email = ?
       LIMIT 1`,
      [identity.email]
    );
    if (byEmail[0]) return byEmail[0];
  }

  if (identity?.first_name) {
    const [byName] = await pool.execute(
      `SELECT *
       FROM patients
       WHERE deleted_at IS NULL
         AND first_name = ?
         AND COALESCE(last_name, '') = COALESCE(?, '')
       LIMIT 1`,
      [identity.first_name, identity.last_name || '']
    );
    if (byName[0]) return byName[0];
  }

  const [fallback] = await pool.execute(
    `SELECT *
     FROM patients
     WHERE deleted_at IS NULL
     ORDER BY created_at ASC
     LIMIT 1`
  );
  return fallback[0] || null;
}

async function getPatientLatestVitals(patientId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      cv.heart_rate,
      cv.systolic_bp,
      cv.diastolic_bp,
      cv.weight_kg,
      cv.height_cm,
      cv.recorded_at
     FROM encounters e
     JOIN clinical_vitals cv ON cv.encounter_id = e.id
     WHERE e.patient_id = ?
     ORDER BY cv.recorded_at DESC
     LIMIT 1`,
    [patientId]
  );
  return rows[0] || null;
}

async function getPatientNextAppointment(patientId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      e.visit_date,
      e.status,
      e.admission_type,
      CONCAT_WS(' ', COALESCE(d.title_prefix, 'Dr.'), d.first_name, d.last_name) AS doctor_name,
      COALESCE(ms.spec_name, 'General Physician') AS specialization
     FROM encounters e
     LEFT JOIN users d ON d.id = e.doctor_id
     LEFT JOIN master_specializations ms ON ms.id = d.specialization_id
     WHERE e.patient_id = ? AND e.visit_date >= NOW()
     ORDER BY e.visit_date ASC
     LIMIT 1`,
    [patientId]
  );
  if (rows[0]) return rows[0];

  const [latest] = await pool.execute(
    `SELECT
      e.visit_date,
      e.status,
      e.admission_type,
      CONCAT_WS(' ', COALESCE(d.title_prefix, 'Dr.'), d.first_name, d.last_name) AS doctor_name,
      COALESCE(ms.spec_name, 'General Physician') AS specialization
     FROM encounters e
     LEFT JOIN users d ON d.id = e.doctor_id
     LEFT JOIN master_specializations ms ON ms.id = d.specialization_id
     WHERE e.patient_id = ?
     ORDER BY e.visit_date DESC
     LIMIT 1`,
    [patientId]
  );
  return latest[0] || null;
}

async function getPatientRecentActivities(patientId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT *
     FROM (
       SELECT
         CONCAT('Encounter ', e.status) AS title,
         CONCAT('Visit type: ', COALESCE(e.admission_type, 'General')) AS description,
         e.visit_date AS activity_at
       FROM encounters e
       WHERE e.patient_id = ?

       UNION ALL

       SELECT
         CONCAT('Invoice ', i.status) AS title,
         CONCAT('Invoice ', i.invoice_no, ' (', FORMAT(i.net_amount, 0), ')') AS description,
         i.created_at AS activity_at
       FROM invoices i
       JOIN encounters e ON e.id = i.encounter_id
       WHERE e.patient_id = ?
     ) x
     ORDER BY x.activity_at DESC
     LIMIT 3`,
    [patientId, patientId]
  );
  return rows;
}

async function getPatientAppointments(patientId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      e.id,
      e.doctor_id,
      e.visit_date,
      e.status,
      e.admission_type,
      CONCAT_WS(' ', COALESCE(d.title_prefix, 'Dr.'), d.first_name, d.last_name) AS doctor_name,
      COALESCE(ms.spec_name, 'General Physician') AS specialization
     FROM encounters e
     LEFT JOIN users d ON d.id = e.doctor_id
     LEFT JOIN master_specializations ms ON ms.id = d.specialization_id
     WHERE e.patient_id = ?
     ORDER BY e.visit_date DESC`,
    [patientId]
  );
  return rows;
}

async function hasDoctorShiftTable() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT 1 AS ok
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'doctor_shifts'
     LIMIT 1`
  );
  return rows.length > 0;
}

function buildShiftSlots(shiftType) {
  const ranges = {
    Morning: [8, 12],
    Afternoon: [13, 17],
    Night: [18, 20]
  };
  const [start, end] = ranges[shiftType] || [8, 12];
  const slots = [];
  for (let hour = start; hour < end; hour += 1) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    slots.push(`${String(hour).padStart(2, '0')}:30`);
  }
  return slots;
}

async function getAvailableSlots(doctorId, dateYmd, excludeEncounterId = '') {
  const pool = getPool();

  let shiftTypes = [];
  if (await hasDoctorShiftTable()) {
    const [shiftRows] = await pool.execute(
      `SELECT shift_type
       FROM doctor_shifts
       WHERE doctor_id = ? AND shift_date = ?`,
      [doctorId, dateYmd]
    );
    shiftTypes = shiftRows.map((r) => r.shift_type);
  }

  if (!shiftTypes.length) {
    // Fallback to default schedule if no shift configured for that date.
    shiftTypes = ['Morning', 'Afternoon'];
  }

  const allSlots = Array.from(new Set(shiftTypes.flatMap(buildShiftSlots)));
  const [encRows] = await pool.execute(
    `SELECT DATE_FORMAT(visit_date, '%H:%i') AS hhmm
     FROM encounters
     WHERE doctor_id = ?
       AND DATE(visit_date) = ?
       AND (? = '' OR id <> ?)`,
    [doctorId, dateYmd, excludeEncounterId, excludeEncounterId]
  );
  const booked = new Set(encRows.map((r) => r.hhmm));

  return allSlots.map((t) => ({
    time: t,
    available: !booked.has(t)
  }));
}

async function getPatientMedicalRecords(patientId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      e.id AS encounter_id,
      e.visit_date,
      e.status,
      e.admission_type,
      CONCAT_WS(' ', COALESCE(d.title_prefix, 'Dr.'), d.first_name, d.last_name) AS doctor_name,
      COALESCE(ms.spec_name, 'General Physician') AS specialization,
      COALESCE(cd.icd10_code, 'N/A') AS diagnosis_code,
      COALESCE(cn.assessment, cn.plan, 'Clinical follow-up') AS diagnosis_label
     FROM encounters e
     LEFT JOIN users d ON d.id = e.doctor_id
     LEFT JOIN master_specializations ms ON ms.id = d.specialization_id
     LEFT JOIN clinical_diagnoses cd ON cd.encounter_id = e.id AND cd.priority = 'Primary'
     LEFT JOIN clinical_notes cn ON cn.encounter_id = e.id
     WHERE e.patient_id = ?
     ORDER BY e.visit_date DESC`,
    [patientId]
  );
  return rows;
}

async function getPatientPrescriptions(patientId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      e.id AS encounter_id,
      e.visit_date,
      e.status,
      CONCAT_WS(' ', COALESCE(d.title_prefix, 'Dr.'), d.first_name, d.last_name) AS doctor_name,
      COALESCE(ms.spec_name, 'General Physician') AS specialization,
      COALESCE(cd.icd10_code, 'RX') AS rx_code,
      COALESCE(cn.plan, cn.assessment, 'Take medicine as directed by doctor') AS instruction
     FROM encounters e
     LEFT JOIN users d ON d.id = e.doctor_id
     LEFT JOIN master_specializations ms ON ms.id = d.specialization_id
     LEFT JOIN clinical_diagnoses cd ON cd.encounter_id = e.id AND cd.priority = 'Primary'
     LEFT JOIN clinical_notes cn ON cn.encounter_id = e.id
     WHERE e.patient_id = ?
     ORDER BY e.visit_date DESC`,
    [patientId]
  );
  return rows;
}

async function getPatientBilling(patientId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      i.id,
      i.invoice_no,
      i.created_at,
      i.total_amount,
      i.discount_amount,
      i.net_amount,
      i.status,
      COALESCE(e.admission_type, 'General Consultation') AS service_name,
      COALESCE(SUM(p.amount_paid), 0) AS paid_amount
     FROM invoices i
     JOIN encounters e ON e.id = i.encounter_id
     LEFT JOIN payments p ON p.invoice_id = i.id
     WHERE e.patient_id = ?
     GROUP BY i.id, i.invoice_no, i.created_at, i.total_amount, i.discount_amount, i.net_amount, i.status, e.admission_type
     ORDER BY i.created_at DESC`,
    [patientId]
  );
  return rows;
}

async function getDoctorOptionsForBooking() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      u.id,
      CONCAT_WS(' ', COALESCE(u.title_prefix, 'Dr.'), u.first_name, u.last_name) AS doctor_name,
      COALESCE(ms.spec_name, 'General Physician') AS specialization
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN master_specializations ms ON ms.id = u.specialization_id
     WHERE u.is_active = TRUE AND LOWER(TRIM(r.role_name)) = 'doctor'
     ORDER BY u.first_name ASC, u.last_name ASC`
  );
  return rows;
}

async function createPatientAppointment(patientId, payload) {
  const pool = getPool();
  const id = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO encounters (
      id, patient_id, doctor_id, visit_date, admission_type, payment_type, status, created_at
    ) VALUES (?, ?, ?, ?, 'Rawat Jalan', 'Mandiri', 'Antre', NOW())`,
    [id, patientId, payload.doctorId, payload.visitDateTime]
  );
  return id;
}

async function updatePatientAppointment(patientId, encounterId, payload) {
  const pool = getPool();
  const [owned] = await pool.execute(
    `SELECT id
     FROM encounters
     WHERE id = ? AND patient_id = ?
     LIMIT 1`,
    [encounterId, patientId]
  );
  if (!owned.length) {
    const e = new Error('Appointment not found');
    e.statusCode = 404;
    throw e;
  }

  await pool.execute(
    `UPDATE encounters
     SET doctor_id = ?, visit_date = ?, status = 'Antre'
     WHERE id = ?`,
    [payload.doctorId, payload.visitDateTime, encounterId]
  );
}

module.exports = {
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
};
