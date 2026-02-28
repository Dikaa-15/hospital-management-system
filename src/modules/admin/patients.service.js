const crypto = require('crypto');
const { getPool } = require('../../config/database');

function buildWhere({ q = '', insurance = '', status = '' }) {
  const where = [];
  const params = [];

  if (q) {
    const like = `%${q}%`;
    where.push(`(
      p.medical_record_number LIKE ?
      OR CONCAT_WS(' ', p.first_name, p.last_name) LIKE ?
      OR p.email LIKE ?
      OR p.insurance_number LIKE ?
    )`);
    params.push(like, like, like, like);
  }

  if (insurance === 'verified') {
    where.push('p.insurance_provider IS NOT NULL AND p.insurance_provider <> ""');
  }
  if (insurance === 'self-pay') {
    where.push('(p.insurance_provider IS NULL OR p.insurance_provider = "")');
  }

  if (status === 'active') {
    where.push('p.deleted_at IS NULL');
  }
  if (status === 'discharged') {
    where.push('p.deleted_at IS NOT NULL');
  }
  if (status === 'emergency-missing') {
    where.push('(p.emergency_name IS NULL OR p.emergency_name = "" OR p.emergency_phone IS NULL OR p.emergency_phone = "")');
  }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

async function listPatients(filters = {}) {
  const pool = getPool();
  const { clause, params } = buildWhere(filters);

  const [rows] = await pool.execute(
    `SELECT
      p.id,
      p.medical_record_number,
      p.first_name,
      p.last_name,
      p.gender,
      p.date_of_birth,
      TIMESTAMPDIFF(YEAR, p.date_of_birth, CURDATE()) AS age,
      p.phone_number,
      p.email,
      p.address,
      p.emergency_name,
      p.emergency_phone,
      p.insurance_provider,
      p.insurance_number,
      p.deleted_at,
      e.visit_date AS last_visit_date,
      CONCAT_WS(' ', u.title_prefix, u.first_name, u.last_name, u.title_suffix) AS last_doctor_name
    FROM patients p
    LEFT JOIN encounters e ON e.id = (
      SELECT e2.id
      FROM encounters e2
      WHERE e2.patient_id = p.id
      ORDER BY e2.visit_date DESC
      LIMIT 1
    )
    LEFT JOIN users u ON u.id = e.doctor_id
    ${clause}
    ORDER BY p.created_at DESC
    LIMIT 300`,
    params
  );

  return rows;
}

async function getPatientById(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      id, medical_record_number, first_name, last_name, gender, date_of_birth,
      phone_number, email, address, emergency_name, emergency_phone,
      insurance_provider, insurance_number, deleted_at
    FROM patients
    WHERE id = ?
    LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

function generateMrn() {
  const n = Math.floor(100000 + Math.random() * 899999);
  return `MRN-${n}`;
}

async function createPatient(payload) {
  const pool = getPool();
  const id = crypto.randomUUID();

  await pool.execute(
    `INSERT INTO patients (
      id, medical_record_number, first_name, last_name, gender, date_of_birth,
      phone_number, email, address, emergency_name, emergency_phone,
      insurance_provider, insurance_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
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

  return getPatientById(id);
}

async function updatePatient(id, payload) {
  const pool = getPool();

  await pool.execute(
    `UPDATE patients
     SET first_name = ?,
         last_name = ?,
         gender = ?,
         date_of_birth = ?,
         phone_number = ?,
         email = ?,
         address = ?,
         emergency_name = ?,
         emergency_phone = ?,
         insurance_provider = ?,
         insurance_number = ?
     WHERE id = ?`,
    [
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
      payload.insuranceNumber || null,
      id
    ]
  );

  return getPatientById(id);
}

async function setPatientActiveState(id, isActive) {
  const pool = getPool();
  if (isActive) {
    await pool.execute('UPDATE patients SET deleted_at = NULL WHERE id = ?', [id]);
  } else {
    await pool.execute('UPDATE patients SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }
}

module.exports = {
  listPatients,
  getPatientById,
  createPatient,
  updatePatient,
  setPatientActiveState
};
