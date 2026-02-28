const {
  listUsers,
  getRoles,
  getSpecializations,
  getUserById,
  createUser,
  updateUser,
  setUserStatus
} = require('./users.service');

function pickFilters(query) {
  return {
    q: (query.q || '').trim(),
    role: (query.role || '').trim(),
    status: (query.status || '').trim()
  };
}

async function renderUserManagement(req, res) {
  const filters = pickFilters(req.query);

  try {
    const [users, roles, specializations] = await Promise.all([
      listUsers(filters),
      getRoles(),
      getSpecializations()
    ]);

    const selectedId = (req.query.edit || '').trim();
    const selectedUser = selectedId ? await getUserById(selectedId) : users[0] || null;

    return res.render('pages/dashboard-admin/user-management', {
      title: 'User Management',
      user: req.session.user,
      users,
      roles,
      specializations,
      filters,
      selectedUser,
      flash: req.query.flash || '',
      error: req.query.error || ''
    });
  } catch (error) {
    return res.status(500).render('pages/dashboard-admin/user-management', {
      title: 'User Management',
      user: req.session.user,
      users: [],
      roles: [],
      specializations: [],
      filters,
      selectedUser: null,
      flash: '',
      error: `Failed to load users: ${error.message}`
    });
  }
}

async function handleCreateUser(req, res) {
  const firstName = (req.body.first_name || '').trim();
  const roleId = (req.body.role_id || '').trim();
  if (!firstName || !roleId) {
    return res.redirect('/templates/dashboard-admin/user-management.html?error=First%20name%20and%20role%20are%20required');
  }

  try {
    await createUser({
      employeeId: (req.body.employee_id || '').trim(),
      username: (req.body.username || '').trim(),
      email: (req.body.email || '').trim(),
      firstName,
      lastName: (req.body.last_name || '').trim(),
      titlePrefix: (req.body.title_prefix || '').trim(),
      titleSuffix: (req.body.title_suffix || '').trim(),
      phoneNumber: (req.body.phone_number || '').trim(),
      roleId,
      specializationId: (req.body.specialization_id || '').trim(),
      password: req.body.password || 'password',
      isActive: req.body.is_active === '1'
    });

    return res.redirect('/templates/dashboard-admin/user-management.html?flash=User created');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/user-management.html?error=${encodeURIComponent(error.message)}`);
  }
}

async function handleUpdateUser(req, res) {
  const userId = req.params.id;
  const firstName = (req.body.first_name || '').trim();
  const roleId = (req.body.role_id || '').trim();
  if (!firstName || !roleId) {
    return res.redirect(`/templates/dashboard-admin/user-management.html?error=First%20name%20and%20role%20are%20required&edit=${userId}`);
  }

  try {
    await updateUser(userId, {
      firstName,
      lastName: (req.body.last_name || '').trim(),
      titlePrefix: (req.body.title_prefix || '').trim(),
      titleSuffix: (req.body.title_suffix || '').trim(),
      email: (req.body.email || '').trim(),
      phoneNumber: (req.body.phone_number || '').trim(),
      roleId,
      specializationId: (req.body.specialization_id || '').trim(),
      password: (req.body.password || '').trim(),
      isActive: req.body.is_active === '1'
    });

    return res.redirect(`/templates/dashboard-admin/user-management.html?flash=User updated&edit=${userId}`);
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/user-management.html?error=${encodeURIComponent(error.message)}&edit=${userId}`);
  }
}

async function handleToggleStatus(req, res) {
  const userId = req.params.id;
  const nextStatus = req.body.next_status === 'active';

  try {
    await setUserStatus(userId, nextStatus);
    return res.redirect('/templates/dashboard-admin/user-management.html?flash=Status updated');
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/user-management.html?error=${encodeURIComponent(error.message)}`);
  }
}

module.exports = {
  renderUserManagement,
  handleCreateUser,
  handleUpdateUser,
  handleToggleStatus
};
