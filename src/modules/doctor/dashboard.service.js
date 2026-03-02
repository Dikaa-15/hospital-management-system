const { getPool } = require('../../config/database');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
let scheduleBootstrapped = false;

async function ensureDoctorShiftTable() {
  if (scheduleBootstrapped) return;
  const pool = getPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS doctor_shifts (
      id CHAR(36) PRIMARY KEY,
      doctor_id CHAR(36) NOT NULL,
      shift_date DATE NOT NULL,
      shift_type VARCHAR(20) NOT NULL,
      department VARCHAR(100) NULL,
      notes VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_doctor_shifts_doctor FOREIGN KEY (doctor_id) REFERENCES users(id),
      CONSTRAINT chk_doctor_shifts_type CHECK (shift_type IN ('Morning', 'Afternoon', 'Night')),
      UNIQUE KEY uq_doctor_shift_date_type (doctor_id, shift_date, shift_type)
    ) ENGINE=InnoDB
  `);
  scheduleBootstrapped = true;
}

async function getDoctorProfile(doctorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      u.id,
      u.employee_id,
      u.first_name,
      u.last_name,
      u.title_prefix,
      u.title_suffix,
      TIMESTAMPDIFF(YEAR, u.created_at, CURDATE()) AS years_exp,
      ms.spec_name
     FROM users u
     LEFT JOIN master_specializations ms ON ms.id = u.specialization_id
     WHERE u.id = ?
     LIMIT 1`,
    [doctorId]
  );
  return rows[0] || null;
}

async function getDoctorMetrics(doctorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      (SELECT COUNT(DISTINCT e.patient_id) FROM encounters e WHERE e.doctor_id = ?) AS patient_count,
      (SELECT COUNT(*) FROM encounters e WHERE e.doctor_id = ? AND DATE(e.visit_date) = CURDATE()) AS appointment_today,
      (SELECT COUNT(*) FROM encounters e WHERE e.doctor_id = ? AND e.admission_type = 'Rawat Inap') AS inpatient_cases,
      (SELECT COUNT(*) FROM encounters e WHERE e.doctor_id = ? AND e.status IN ('Antre', 'Pemeriksaan')) AS active_queue`,
    [doctorId, doctorId, doctorId, doctorId]
  );
  return rows[0] || { patient_count: 0, appointment_today: 0, inpatient_cases: 0, active_queue: 0 };
}

async function getDoctorExtraStats(doctorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      COALESCE((
        SELECT SUM(i.net_amount)
        FROM invoices i
        JOIN encounters e ON e.id = i.encounter_id
        WHERE e.doctor_id = ?
          AND i.status = 'Paid'
          AND YEAR(i.created_at) = YEAR(CURDATE())
          AND MONTH(i.created_at) = MONTH(CURDATE())
      ), 0) AS revenue_month,
      COALESCE((
        SELECT SUM(i.net_amount)
        FROM invoices i
        JOIN encounters e ON e.id = i.encounter_id
        WHERE e.doctor_id = ?
          AND i.status = 'Paid'
          AND YEAR(i.created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
          AND MONTH(i.created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
      ), 0) AS revenue_prev_month,
      COALESCE((
        SELECT ROUND(100 * SUM(CASE WHEN e.status = 'Selesai' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 1)
        FROM encounters e
        WHERE e.doctor_id = ?
          AND YEAR(e.visit_date) = YEAR(CURDATE())
          AND MONTH(e.visit_date) = MONTH(CURDATE())
      ), 0) AS completion_rate,
      COALESCE((
        SELECT COUNT(*)
        FROM encounters e
        WHERE e.doctor_id = ?
          AND e.admission_type = 'Rawat Inap'
          AND e.status IN ('Antre', 'Pemeriksaan', 'Farmasi')
      ), 0) AS beds_occupied,
      COALESCE((
        SELECT COUNT(*)
        FROM encounters e
        WHERE e.doctor_id = ?
          AND e.status IN ('Antre', 'Pemeriksaan')
      ), 0) AS critical_patients`,
    [doctorId, doctorId, doctorId, doctorId, doctorId]
  );

  const item = rows[0] || {};
  const revenueMonth = Number(item.revenue_month || 0);
  const revenuePrev = Number(item.revenue_prev_month || 0);
  const growthPct = revenuePrev > 0 ? Number((((revenueMonth - revenuePrev) / revenuePrev) * 100).toFixed(1)) : 0;

  return {
    revenueMonth,
    revenuePrev,
    growthPct,
    completionRate: Number(item.completion_rate || 0),
    bedsOccupied: Number(item.beds_occupied || 0),
    criticalPatients: Number(item.critical_patients || 0)
  };
}

async function getRecentPatients(doctorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      p.id,
      CONCAT_WS(' ', p.first_name, p.last_name) AS patient_name,
      p.gender,
      TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
      e.visit_date,
      COALESCE(d.icd10_code, 'N/A') AS condition_code,
      CASE
        WHEN e.status IN ('Pemeriksaan') THEN 'Monitoring'
        WHEN e.status IN ('Antre') THEN 'Waiting'
        WHEN e.status = 'Selesai' THEN 'Stable'
        ELSE 'Active'
      END AS status
    FROM encounters e
    JOIN patients p ON p.id = e.patient_id
    LEFT JOIN clinical_diagnoses d ON d.encounter_id = e.id AND d.priority = 'Primary'
    WHERE e.doctor_id = ?
    ORDER BY e.visit_date DESC
    LIMIT 8`,
    [doctorId]
  );
  return rows;
}

async function getTodaySchedule(doctorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      e.id,
      e.visit_date,
      e.status,
      e.admission_type,
      CONCAT_WS(' ', p.first_name, p.last_name) AS patient_name
    FROM encounters e
    JOIN patients p ON p.id = e.patient_id
    WHERE e.doctor_id = ? AND DATE(e.visit_date) = CURDATE()
    ORDER BY e.visit_date ASC
    LIMIT 12`,
    [doctorId]
  );
  return rows;
}

async function getWeeklyChart(doctorId) {
  const pool = getPool();
  const [weekRows] = await pool.execute(
    `SELECT
      DATE(e.visit_date) AS d,
      COUNT(*) AS total
    FROM encounters e
    WHERE e.doctor_id = ? AND e.visit_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY DATE(e.visit_date)
    ORDER BY d ASC`,
    [doctorId]
  );

  const weekMap = new Map(weekRows.map((r) => [String(r.d).slice(0, 10), Number(r.total)]));
  const weekLabels = [];
  const weekData = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    weekLabels.push(dt.toLocaleDateString('en-US', { weekday: 'short' }));
    weekData.push(weekMap.get(key) || 0);
  }

  const [monthRows] = await pool.execute(
    `SELECT
      DATE(e.visit_date) AS d,
      COUNT(*) AS total
    FROM encounters e
    WHERE e.doctor_id = ? AND e.visit_date >= DATE_SUB(CURDATE(), INTERVAL 27 DAY)
    GROUP BY DATE(e.visit_date)
    ORDER BY d ASC`,
    [doctorId]
  );

  const monthMap = new Map(monthRows.map((r) => [String(r.d).slice(0, 10), Number(r.total)]));
  const monthData = [0, 0, 0, 0];
  for (let i = 27; i >= 0; i -= 1) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    const bucket = Math.min(3, Math.floor((27 - i) / 7));
    monthData[bucket] += monthMap.get(key) || 0;
  }

  const [yearRows] = await pool.execute(
    `SELECT
      QUARTER(e.visit_date) AS q,
      COUNT(*) AS total
    FROM encounters e
    WHERE e.doctor_id = ? AND YEAR(e.visit_date) = YEAR(CURDATE())
    GROUP BY QUARTER(e.visit_date)`,
    [doctorId]
  );

  const yearMap = new Map(yearRows.map((r) => [Number(r.q), Number(r.total)]));
  const yearData = [1, 2, 3, 4].map((q) => yearMap.get(q) || 0);

  return {
    week: { labels: weekLabels, data: weekData },
    month: { labels: ['W1', 'W2', 'W3', 'W4'], data: monthData },
    year: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], data: yearData }
  };
}

async function getDepartmentOverview() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT admission_type, COUNT(*) AS total
     FROM encounters
     WHERE visit_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
     GROUP BY admission_type`
  );

  const max = Math.max(...rows.map((r) => Number(r.total || 0)), 1);
  return rows.map((r) => ({
    name: r.admission_type || 'Unknown',
    total: Number(r.total || 0),
    max,
    pct: Math.round((Number(r.total || 0) / max) * 100)
  }));
}

async function getDoctorPatientDirectory(doctorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      p.id AS patient_uuid,
      p.medical_record_number,
      p.first_name,
      p.last_name,
      p.gender,
      p.date_of_birth,
      p.phone_number,
      p.email,
      p.address,
      e.id AS encounter_id,
      e.visit_date,
      e.status AS encounter_status,
      e.admission_type,
      COALESCE(d.icd10_code, 'N/A') AS diagnosis,
      cv.heart_rate,
      cv.systolic_bp,
      cv.diastolic_bp,
      cv.temp_celcius,
      cv.weight_kg,
      cv.height_cm,
      cn.plan AS clinical_plan
    FROM encounters e
    JOIN (
      SELECT patient_id, MAX(visit_date) AS max_visit
      FROM encounters
      WHERE doctor_id = ?
      GROUP BY patient_id
    ) latest ON latest.patient_id = e.patient_id AND latest.max_visit = e.visit_date
    JOIN patients p ON p.id = e.patient_id
    LEFT JOIN clinical_diagnoses d ON d.encounter_id = e.id AND d.priority = 'Primary'
    LEFT JOIN clinical_vitals cv ON cv.encounter_id = e.id
    LEFT JOIN clinical_notes cn ON cn.encounter_id = e.id
    WHERE e.doctor_id = ?
      AND p.deleted_at IS NULL
    ORDER BY e.visit_date DESC
    LIMIT 250`,
    [doctorId, doctorId]
  );
  return rows;
}

async function doctorHasPatientAccess(doctorId, patientId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT 1
     FROM encounters e
     JOIN patients p ON p.id = e.patient_id
     WHERE e.doctor_id = ? AND e.patient_id = ? AND p.deleted_at IS NULL
     LIMIT 1`,
    [doctorId, patientId]
  );
  return rows.length > 0;
}

function generateMrn() {
  const n = Math.floor(100000 + Math.random() * 899999);
  return `MRN-${n}`;
}

async function createDoctorPatient(doctorId, payload) {
  const pool = getPool();
  const patientId = crypto.randomUUID();
  const encounterId = crypto.randomUUID();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      `INSERT INTO patients (
        id, medical_record_number, first_name, last_name, gender, date_of_birth,
        phone_number, email, address, emergency_name, emergency_phone,
        insurance_provider, insurance_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId,
        payload.medicalRecordNumber || generateMrn(),
        payload.firstName,
        payload.lastName || null,
        payload.gender || null,
        payload.dateOfBirth,
        payload.phoneNumber || null,
        payload.email || null,
        payload.address || null,
        payload.emergencyName || null,
        payload.emergencyPhone || null,
        payload.insuranceProvider || null,
        payload.insuranceNumber || null
      ]
    );

    await conn.execute(
      `INSERT INTO encounters (
        id, patient_id, doctor_id, visit_date, admission_type, payment_type, status
      ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'Rawat Jalan', 'Mandiri', 'Antre')`,
      [encounterId, patientId, doctorId]
    );

    await conn.commit();
    return patientId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updateDoctorPatient(doctorId, patientId, payload) {
  const hasAccess = await doctorHasPatientAccess(doctorId, patientId);
  if (!hasAccess) {
    const error = new Error('Patient not found in your directory');
    error.statusCode = 404;
    throw error;
  }

  const pool = getPool();
  await pool.execute(
    `UPDATE patients
     SET first_name = ?,
         last_name = ?,
         gender = ?,
         date_of_birth = ?,
         phone_number = ?,
         email = ?,
         address = ?
     WHERE id = ?`,
    [
      payload.firstName,
      payload.lastName || null,
      payload.gender || null,
      payload.dateOfBirth,
      payload.phoneNumber || null,
      payload.email || null,
      payload.address || null,
      patientId
    ]
  );
}

async function deleteDoctorPatient(doctorId, patientId) {
  const hasAccess = await doctorHasPatientAccess(doctorId, patientId);
  if (!hasAccess) {
    const error = new Error('Patient not found in your directory');
    error.statusCode = 404;
    throw error;
  }

  const pool = getPool();
  await pool.execute('UPDATE patients SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [patientId]);
}

async function getDoctorPatientsLookup(doctorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT DISTINCT p.id, p.medical_record_number, CONCAT_WS(' ', p.first_name, p.last_name) AS patient_name
     FROM encounters e
     JOIN patients p ON p.id = e.patient_id
     WHERE e.doctor_id = ? AND p.deleted_at IS NULL
     ORDER BY patient_name ASC`,
    [doctorId]
  );
  return rows;
}

async function getDoctorAppointments(doctorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      e.id,
      e.patient_id,
      e.visit_date,
      e.status,
      e.admission_type,
      CONCAT_WS(' ', p.first_name, p.last_name) AS patient_name,
      p.medical_record_number
     FROM encounters e
     JOIN patients p ON p.id = e.patient_id
     WHERE e.doctor_id = ? AND p.deleted_at IS NULL
     ORDER BY e.visit_date DESC
     LIMIT 300`,
    [doctorId]
  );
  return rows;
}

async function createDoctorAppointment(doctorId, payload) {
  const pool = getPool();
  const hasAccess = await doctorHasPatientAccess(doctorId, payload.patientId);
  if (!hasAccess) {
    const error = new Error('Patient is not in your directory');
    error.statusCode = 404;
    throw error;
  }

  const encounterId = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO encounters (
      id, patient_id, doctor_id, visit_date, admission_type, payment_type, status
    ) VALUES (?, ?, ?, ?, ?, 'Mandiri', 'Antre')`,
    [encounterId, payload.patientId, doctorId, payload.visitDate, payload.admissionType || 'Rawat Jalan']
  );
}

async function updateDoctorAppointmentStatus(doctorId, encounterId, nextStatus) {
  const allowed = ['Antre', 'Pemeriksaan', 'Farmasi', 'Selesai'];
  if (!allowed.includes(nextStatus)) {
    const error = new Error('Invalid status');
    error.statusCode = 400;
    throw error;
  }

  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id FROM encounters WHERE id = ? AND doctor_id = ? LIMIT 1',
    [encounterId, doctorId]
  );
  if (!rows.length) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }

  await pool.execute('UPDATE encounters SET status = ? WHERE id = ?', [nextStatus, encounterId]);
}

async function getDoctorShifts(doctorId) {
  await ensureDoctorShiftTable();
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, DATE_FORMAT(shift_date, '%Y-%m-%d') AS shift_date, shift_type, department, notes
     FROM doctor_shifts
     WHERE doctor_id = ?
     ORDER BY shift_date ASC, shift_type ASC`,
    [doctorId]
  );
  return rows;
}

async function createDoctorShift(doctorId, payload) {
  await ensureDoctorShiftTable();
  const pool = getPool();
  const id = crypto.randomUUID();
  await pool.execute(
    `INSERT INTO doctor_shifts (id, doctor_id, shift_date, shift_type, department, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, doctorId, payload.shiftDate, payload.shiftType, payload.department || null, payload.notes || null]
  );
}

async function deleteDoctorShift(doctorId, shiftId) {
  await ensureDoctorShiftTable();
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM doctor_shifts WHERE id = ? AND doctor_id = ?', [shiftId, doctorId]);
  if (!result.affectedRows) {
    const error = new Error('Shift not found');
    error.statusCode = 404;
    throw error;
  }
}

async function updateDoctorShift(doctorId, shiftId, payload) {
  await ensureDoctorShiftTable();
  const pool = getPool();
  const [result] = await pool.execute(
    `UPDATE doctor_shifts
     SET shift_date = ?,
         shift_type = ?,
         department = ?,
         notes = ?
     WHERE id = ? AND doctor_id = ?`,
    [payload.shiftDate, payload.shiftType, payload.department || null, payload.notes || null, shiftId, doctorId]
  );
  if (!result.affectedRows) {
    const error = new Error('Shift not found');
    error.statusCode = 404;
    throw error;
  }
}

async function getDoctorReportSummary(doctorId) {
  const pool = getPool();

  const [kpiRows] = await pool.execute(
    `SELECT
      COUNT(*) AS total_consultations,
      SUM(CASE WHEN e.status = 'Selesai' THEN 1 ELSE 0 END) AS completed_consultations,
      COALESCE((
        SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, e2.visit_date, i.created_at)), 1)
        FROM encounters e2
        JOIN invoices i ON i.encounter_id = e2.id
        WHERE e2.doctor_id = ?
          AND i.created_at >= e2.visit_date
      ), 0) AS avg_consultation_min,
      COALESCE((
        SELECT COUNT(*)
        FROM clinical_notes cn
        JOIN encounters e3 ON e3.id = cn.encounter_id
        WHERE e3.doctor_id = ? AND cn.is_finalized = 0
      ), 0) AS pending_reports
     FROM encounters e
     WHERE e.doctor_id = ?`,
    [doctorId, doctorId, doctorId]
  );
  const kpi = kpiRows[0] || {};

  const [trendRows] = await pool.execute(
    `SELECT
      DATE_FORMAT(e.visit_date, '%Y-%m') AS ym,
      DATE_FORMAT(e.visit_date, '%b') AS month_label,
      SUM(CASE WHEN e.admission_type = 'Rawat Inap' THEN 1 ELSE 0 END) AS cardiology,
      SUM(CASE WHEN e.admission_type = 'Rawat Jalan' THEN 1 ELSE 0 END) AS general,
      SUM(CASE WHEN e.admission_type = 'IGD' THEN 1 ELSE 0 END) AS emergency
     FROM encounters e
     WHERE e.doctor_id = ?
       AND e.visit_date >= DATE_SUB(CURDATE(), INTERVAL 5 MONTH)
     GROUP BY DATE_FORMAT(e.visit_date, '%Y-%m'), DATE_FORMAT(e.visit_date, '%b')
     ORDER BY ym ASC`,
    [doctorId]
  );

  const [reportRows] = await pool.execute(
    `SELECT *
     FROM (
       SELECT
         CONCAT('Clinical Note - ', COALESCE(CONCAT_WS(' ', p.first_name, p.last_name), 'Patient')) AS report_name,
         'Clinical' AS category,
         cn.created_at AS created_at,
         CASE WHEN cn.is_finalized = 1 THEN 'ready' ELSE 'pending' END AS status
       FROM clinical_notes cn
       JOIN encounters e ON e.id = cn.encounter_id
       JOIN patients p ON p.id = e.patient_id
       WHERE e.doctor_id = ?
       UNION ALL
       SELECT
         CONCAT('Invoice - ', i.invoice_no) AS report_name,
         'Billing' AS category,
         i.created_at AS created_at,
         CASE WHEN i.status = 'Paid' THEN 'ready' ELSE 'pending' END AS status
       FROM invoices i
       JOIN encounters e ON e.id = i.encounter_id
       WHERE e.doctor_id = ?
     ) t
     ORDER BY t.created_at DESC
     LIMIT 12`,
    [doctorId, doctorId]
  );

  const [demographicRows] = await pool.execute(
    `SELECT
      SUM(CASE WHEN age BETWEEN 18 AND 30 THEN 1 ELSE 0 END) AS age_18_30,
      SUM(CASE WHEN age BETWEEN 31 AND 50 THEN 1 ELSE 0 END) AS age_31_50,
      SUM(CASE WHEN age BETWEEN 51 AND 65 THEN 1 ELSE 0 END) AS age_51_65,
      SUM(CASE WHEN age >= 66 THEN 1 ELSE 0 END) AS age_66_plus
     FROM (
       SELECT DISTINCT p.id, TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age
       FROM encounters e
       JOIN patients p ON p.id = e.patient_id
       WHERE e.doctor_id = ?
     ) x`,
    [doctorId]
  );

  return {
    kpi,
    trendRows,
    reportRows,
    demographic: demographicRows[0] || { age_18_30: 0, age_31_50: 0, age_51_65: 0, age_66_plus: 0 }
  };
}

async function getDoctorSettings(doctorId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      u.id,
      u.employee_id,
      u.first_name,
      u.last_name,
      u.title_prefix,
      u.email,
      u.phone_number,
      u.specialization_id,
      ms.spec_name AS specialization_name
     FROM users u
     LEFT JOIN master_specializations ms ON ms.id = u.specialization_id
     WHERE u.id = ?
     LIMIT 1`,
    [doctorId]
  );
  return rows[0] || null;
}

async function getSpecializationOptions() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, spec_name
     FROM master_specializations
     WHERE is_active = 1
     ORDER BY spec_name ASC`
  );
  return rows;
}

async function updateDoctorSettingsProfile(doctorId, payload) {
  const pool = getPool();
  try {
    await pool.execute(
      `UPDATE users
       SET first_name = ?,
           last_name = ?,
           title_prefix = ?,
           phone_number = ?,
           email = ?,
           specialization_id = ?
       WHERE id = ?`,
      [
        payload.firstName,
        payload.lastName || null,
        payload.titlePrefix || null,
        payload.phoneNumber || null,
        payload.email || null,
        payload.specializationId || null,
        doctorId
      ]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const e = new Error('Email is already used by another user');
      e.statusCode = 400;
      throw e;
    }
    throw error;
  }
}

async function updateDoctorSettingsPassword(doctorId, payload) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT password_hash
     FROM users
     WHERE id = ?
     LIMIT 1`,
    [doctorId]
  );

  const user = rows[0];
  if (!user) {
    const e = new Error('Doctor account not found');
    e.statusCode = 404;
    throw e;
  }
  if (!user.password_hash) {
    const e = new Error('Password update is not available for this account');
    e.statusCode = 400;
    throw e;
  }

  const validCurrent = await bcrypt.compare(payload.currentPassword, user.password_hash);
  if (!validCurrent) {
    const e = new Error('Current password is invalid');
    e.statusCode = 400;
    throw e;
  }

  const newHash = await bcrypt.hash(payload.newPassword, 10);
  await pool.execute(
    `UPDATE users
     SET password_hash = ?
     WHERE id = ?`,
    [newHash, doctorId]
  );
}

module.exports = {
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
};
