const {
  getFinanceSummary,
  listInvoices,
  getInvoiceById,
  listRecentClaims,
  createPayment,
  updateInvoiceStatus
} = require('./finance.service');

function pickFilters(query) {
  return {
    range: (query.range || 'today').trim(),
    status: (query.status || '').trim(),
    q: (query.q || '').trim()
  };
}

async function renderFinanceDashboard(req, res) {
  const filters = pickFilters(req.query);

  try {
    const [summary, invoices, claims] = await Promise.all([
      getFinanceSummary(filters.range),
      listInvoices(filters),
      listRecentClaims()
    ]);

    const selectedId = (req.query.invoice || '').trim();
    const selectedInvoice = selectedId
      ? await getInvoiceById(selectedId)
      : invoices[0] || null;

    return res.render('pages/dashboard-admin/financial-management', {
      title: 'Financial Dashboard',
      user: req.session.user,
      summary,
      invoices,
      claims,
      filters,
      selectedInvoice,
      flash: req.query.flash || '',
      error: req.query.error || ''
    });
  } catch (error) {
    return res.status(500).render('pages/dashboard-admin/financial-management', {
      title: 'Financial Dashboard',
      user: req.session.user,
      summary: { total_revenue: 0, outstanding_bills: 0, pending_claims: 0, insurance_savings: 0 },
      invoices: [],
      claims: [],
      filters,
      selectedInvoice: null,
      flash: '',
      error: `Failed to load finance dashboard: ${error.message}`
    });
  }
}

async function handleCreatePayment(req, res) {
  const invoiceId = (req.body.invoice_id || '').trim();
  const paymentMethod = (req.body.payment_method || '').trim();
  const amountPaid = Number(req.body.amount_paid || 0);

  if (!invoiceId || !paymentMethod || amountPaid <= 0) {
    return res.redirect('/templates/dashboard-admin/financial-management?error=Invoice%2C%20payment%20method%2C%20and%20amount%20are%20required');
  }

  try {
    await createPayment({
      invoiceId,
      paymentMethod,
      amountPaid,
      recordedBy: req.session.user?.id || null
    });

    return res.redirect(`/templates/dashboard-admin/financial-management?flash=Payment%20posted&invoice=${invoiceId}`);
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/financial-management?error=${encodeURIComponent(error.message)}&invoice=${invoiceId}`);
  }
}

async function handleInvoiceStatus(req, res) {
  const invoiceId = req.params.id;
  const status = (req.body.status || '').trim();
  const allowed = new Set(['Draft', 'Unpaid', 'Paid', 'Cancelled']);
  if (!allowed.has(status)) {
    return res.redirect('/templates/dashboard-admin/financial-management?error=Invalid%20invoice%20status');
  }

  try {
    await updateInvoiceStatus(invoiceId, status);
    return res.redirect(`/templates/dashboard-admin/financial-management?flash=Invoice%20status%20updated&invoice=${invoiceId}`);
  } catch (error) {
    return res.redirect(`/templates/dashboard-admin/financial-management?error=${encodeURIComponent(error.message)}&invoice=${invoiceId}`);
  }
}

module.exports = {
  renderFinanceDashboard,
  handleCreatePayment,
  handleInvoiceStatus
};
