const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getPool } = require('../../config/database');

function buildWhere({ q = '', role = '', status = '' }) {
  const where = [];
  const params = [];

  if (q) {
    where.push(`(
      CONCAT_WS(' ', u.first_name, u.last_name) LIKE ?
      OR u.employee_id LIKE ?
      OR u.email LIKE ?
      OR u.username LIKE ?
    )`);
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }

  if (role) {
    where.push('r.role_name = ?');
    params.push(role);
  }

  if (status === 'active') {
    where.push('u.is_active = TRUE');
  }
  if (status === 'inactive') {
    where.push('u.is_active = FALSE');
  }

  return {
    clause: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params
  };
}

async function listUsers(filters = {}) {
  const pool = getPool();
  const { clause, params } = buildWhere(filters);

  const [rows] = await pool.execute(
    `SELECT
      u.id, u.employee_id, u.username, u.email, u.first_name, u.last_name,
      u.title_prefix, u.title_suffix, u.phone_number, u.is_active, u.created_at,
      r.id AS role_id, r.role_name,
      s.id AS specialization_id, s.spec_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN master_specializations s ON s.id = u.specialization_id
    ${clause}
    ORDER BY u.created_at DESC
    LIMIT 200`,
    params
  );

  return rows;
}

async function getRoles() {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT id, role_name FROM roles ORDER BY role_name ASC');
  return rows;
}

async function getSpecializations() {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id, spec_name FROM master_specializations WHERE is_active = TRUE ORDER BY spec_name ASC'
  );
  return rows;
}

async function getUserById(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      u.id, u.employee_id, u.username, u.email, u.first_name, u.last_name,
      u.title_prefix, u.title_suffix, u.phone_number, u.is_active,
      r.id AS role_id, r.role_name,
      s.id AS specialization_id, s.spec_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    LEFT JOIN master_specializations s ON s.id = u.specialization_id
    WHERE u.id = ?
    LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

function generateEmployeeId() {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `STF-${suffix}`;
}

async function createUser(payload) {
  const pool = getPool();
  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(payload.password, 10);

  const employeeId = payload.employeeId || generateEmployeeId();
  const username = payload.username || payload.email;

  await pool.execute(
    `INSERT INTO users (
      id, employee_id, username, password_hash,
      first_name, last_name, title_prefix, title_suffix,
      role_id, specialization_id, email, phone_number, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      employeeId,
      username,
      passwordHash,
      payload.firstName,
      payload.lastName || null,
      payload.titlePrefix || null,
      payload.titleSuffix || null,
      payload.roleId,
      payload.specializationId || null,
      payload.email || null,
      payload.phoneNumber || null,
      Boolean(payload.isActive)
    ]
  );

  return getUserById(id);
}

async function updateUser(id, payload) {
  const pool = getPool();

  const values = [
    payload.firstName,
    payload.lastName || null,
    payload.titlePrefix || null,
    payload.titleSuffix || null,
    payload.roleId,
    payload.specializationId || null,
    payload.email || null,
    payload.phoneNumber || null,
    Boolean(payload.isActive),
    id
  ];

  await pool.execute(
    `UPDATE users
     SET first_name = ?,
         last_name = ?,
         title_prefix = ?,
         title_suffix = ?,
         role_id = ?,
         specialization_id = ?,
         email = ?,
         phone_number = ?,
         is_active = ?
     WHERE id = ?`,
    values
  );

  if (payload.password) {
    const passwordHash = await bcrypt.hash(payload.password, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  }

  return getUserById(id);
}

async function setUserStatus(id, isActive) {
  const pool = getPool();
  await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [Boolean(isActive), id]);
}

module.exports = {
  listUsers,
  getRoles,
  getSpecializations,
  getUserById,
  createUser,
  updateUser,
  setUserStatus
};
