const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { allowRoles } = require('../../middlewares/rbac');
const {
  renderInventoryManagement,
  handleCreateItem,
  handleUpdateItem,
  handleItemStatus,
  handleCreateBatch
} = require('./inventory.controller');

const router = express.Router();

router.get('/templates/dashboard-admin/inventory-management', requireAuth, allowRoles('admin', 'pharmacist'), renderInventoryManagement);
router.get('/templates/dashboard-admin/inventory-management.html', requireAuth, allowRoles('admin', 'pharmacist'), renderInventoryManagement);
router.post('/admin/inventory/items', requireAuth, allowRoles('admin', 'pharmacist'), handleCreateItem);
router.post('/admin/inventory/items/:id/update', requireAuth, allowRoles('admin', 'pharmacist'), handleUpdateItem);
router.post('/admin/inventory/items/:id/status', requireAuth, allowRoles('admin', 'pharmacist'), handleItemStatus);
router.post('/admin/inventory/batches', requireAuth, allowRoles('admin', 'pharmacist'), handleCreateBatch);

module.exports = router;
