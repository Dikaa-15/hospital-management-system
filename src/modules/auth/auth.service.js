const bcrypt = require('bcryptjs');
const { getPool } = require('../../config/database');

const demoUsers = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    username: 'admin@gmail.com',
    email: 'admin@gmail.com',
    password: 'password',
    fullName: 'Admin HMS',
    role: 'admin'
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    username: 'docter@gmail.com',
    email: 'docter@gmail.com',
    password: 'password',
    fullName: 'Doctor HMS',
    role: 'doctor'
  },
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    username: 'patient@gmail.com',
    email: 'patient@gmail.com',
    password: 'password',
    fullName: 'Patient HMS',
    role: 'patient'
  },
  {
    id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
    username: 'pharmacist@gmail.com',
    email: 'pharmacist@gmail.com',
    password: 'password',
    fullName: 'Pharmacist HMS',
    role: 'pharmacist'
  }
];

async function findUserByIdentifier(identifier) {
  const authMode = process.env.AUTH_MODE || 'demo';
  if (authMode === 'demo') {
    return demoUsers.find(
      (u) => u.username.toLowerCase() === identifier.toLowerCase() || u.email.toLowerCase() === identifier.toLowerCase()
    );
  }

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.email,
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS full_name,
            u.password_hash,
            r.role_name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.is_active = 1 AND (u.username = ? OR u.email = ?)
     LIMIT 1`,
    [identifier, identifier]
  );

  if (!rows.length) return null;
  const row = rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    fullName: row.full_name?.trim() || row.username,
    passwordHash: row.password_hash,
    role: row.role
  };
}

async function verifyCredentials(identifier, password) {
  const user = await findUserByIdentifier(identifier);
  if (!user) return null;

  const authMode = process.env.AUTH_MODE || 'demo';
  const valid = authMode === 'demo' ? user.password === password : await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    role: user.role
  };
}

module.exports = { verifyCredentials };
