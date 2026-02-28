const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { allowRoles } = require('../../middlewares/rbac');
const {
  renderUserManagement,
  handleCreateUser,
  handleUpdateUser,
  handleToggleStatus
} = require('./users.controller');

const router = express.Router();

router.get('/templates/dashboard-admin/user-management.html', requireAuth, allowRoles('admin'), renderUserManagement);
router.post('/admin/users', requireAuth, allowRoles('admin'), handleCreateUser);
router.post('/admin/users/:id/update', requireAuth, allowRoles('admin'), handleUpdateUser);
router.post('/admin/users/:id/status', requireAuth, allowRoles('admin'), handleToggleStatus);

module.exports = router;
