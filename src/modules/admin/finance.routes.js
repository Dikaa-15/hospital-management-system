const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { allowRoles } = require('../../middlewares/rbac');
const {
  renderFinanceDashboard,
  handleCreatePayment,
  handleInvoiceStatus
} = require('./finance.controller');

const router = express.Router();

router.get('/templates/dashboard-admin/financial-management', requireAuth, allowRoles('admin'), renderFinanceDashboard);
router.get('/templates/dashboard-admin/financial-management.html', requireAuth, allowRoles('admin'), renderFinanceDashboard);
router.post('/admin/finance/payments', requireAuth, allowRoles('admin'), handleCreatePayment);
router.post('/admin/finance/invoices/:id/status', requireAuth, allowRoles('admin'), handleInvoiceStatus);

module.exports = router;
