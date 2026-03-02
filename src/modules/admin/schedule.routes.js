const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { allowRoles } = require('../../middlewares/rbac');
const {
  renderScheduleWard,
  handleCreateShift,
  handleDeleteShift,
  handleCreateRoom,
  handleRoomStatus,
  handleCreateTransfer,
  handleTransferStatus
} = require('./schedule.controller');

const router = express.Router();

router.get('/templates/dashboard-admin/schedule-ward-management', requireAuth, allowRoles('admin'), renderScheduleWard);
router.get('/templates/dashboard-admin/schedule-ward-management.html', requireAuth, allowRoles('admin'), renderScheduleWard);
router.post('/admin/schedule/shifts', requireAuth, allowRoles('admin'), handleCreateShift);
router.post('/admin/schedule/shifts/:id/delete', requireAuth, allowRoles('admin'), handleDeleteShift);
router.post('/admin/wards', requireAuth, allowRoles('admin'), handleCreateRoom);
router.post('/admin/wards/:id/status', requireAuth, allowRoles('admin'), handleRoomStatus);
router.post('/admin/transfers', requireAuth, allowRoles('admin'), handleCreateTransfer);
router.post('/admin/transfers/:id/status', requireAuth, allowRoles('admin'), handleTransferStatus);

module.exports = router;
