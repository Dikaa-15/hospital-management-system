const bcrypt = require('bcryptjs');
const { getSupabaseClient } = require('../../config/supabase');
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

  // 1. LOGIKA DEMO
  if (authMode === 'demo') {
    return demoUsers.find(
      (u) => u.username.toLowerCase() === identifier.toLowerCase() || u.email.toLowerCase() === identifier.toLowerCase()
    );
  }

  // 2. LOGIKA SUPABASE (Tambahkan ini!)
  if (authMode === 'supabase') {
    const supabase = getSupabaseClient();
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id, username, email, password_hash, first_name, last_name,
        roles (role_name)
      `)
      .or(`username.eq.${identifier},email.eq.${identifier}`)
      .eq('is_active', true)
      .single();

    if (error || !user) return null;

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: `${user.first_name} ${user.last_name || ''}`.trim() || user.username,
      passwordHash: user.password_hash,
      role: user.roles?.role_name || 'user'
    };
  }

  // 3. LOGIKA MYSQL (Lokal)
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.email, 
            CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) AS full_name, 
            u.password_hash, r.role_name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.is_active = TRUE AND (u.username = ? OR u.email = ?) LIMIT 1`,
    [identifier, identifier]
  );

  if (!rows.length) return null;
  return {
    id: rows[0].id,
    username: rows[0].username,
    email: rows[0].email,
    fullName: rows[0].full_name?.trim() || rows[0].username,
    passwordHash: rows[0].password_hash,
    role: rows[0].role
  };
}

async function verifyCredentials(identifier, password) {
  const user = await findUserByIdentifier(identifier);
  if (!user) return null;

  const authMode = process.env.AUTH_MODE || 'demo';
  
  // Jika demo pakai plain text, jika db/supabase pakai bcrypt
  const valid = authMode === 'demo' 
    ? user.password === password 
    : await bcrypt.compare(password, user.passwordHash);

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
