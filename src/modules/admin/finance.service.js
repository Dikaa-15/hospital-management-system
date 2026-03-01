const crypto = require('crypto');
const { getPool } = require('../../config/database');

function buildDateClause(range = 'today') {
  if (range === '7d') return 'AND i.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
  if (range === '30d') return 'AND i.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
  return 'AND DATE(i.created_at) = CURDATE()';
}

async function getFinanceSummary(range = 'today') {
  const pool = getPool();
  const dateClause = buildDateClause(range);

  const [rows] = await pool.execute(
    `SELECT
      COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.net_amount ELSE 0 END), 0) AS total_revenue,
      COALESCE(SUM(CASE WHEN i.status = 'Unpaid' THEN i.net_amount ELSE 0 END), 0) AS outstanding_bills,
      COALESCE(SUM(CASE WHEN i.status = 'Draft' THEN i.net_amount ELSE 0 END), 0) AS pending_claims,
      COALESCE(SUM(i.discount_amount), 0) AS insurance_savings
    FROM invoices i
    WHERE 1=1 ${dateClause}`
  );

  return rows[0] || { total_revenue: 0, outstanding_bills: 0, pending_claims: 0, insurance_savings: 0 };
}

async function listInvoices({ range = 'today', status = '', q = '' } = {}) {
  const pool = getPool();
  const params = [];
  const filters = [buildDateClause(range)];

  if (status) {
    filters.push('AND i.status = ?');
    params.push(status);
  }

  if (q) {
    filters.push('AND (i.invoice_no LIKE ? OR CONCAT_WS(" ", p.first_name, p.last_name) LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like);
  }

  const [rows] = await pool.execute(
    `SELECT
      i.id,
      i.invoice_no,
      i.total_amount,
      i.discount_amount,
      i.net_amount,
      i.status,
      i.created_at,
      e.payment_type,
      CONCAT_WS(' ', p.first_name, p.last_name) AS patient_name,
      COALESCE(pay.total_paid, 0) AS total_paid,
      pay.latest_method
    FROM invoices i
    LEFT JOIN encounters e ON e.id = i.encounter_id
    LEFT JOIN patients p ON p.id = e.patient_id
    LEFT JOIN (
      SELECT
        invoice_id,
        SUM(amount_paid) AS total_paid,
        SUBSTRING_INDEX(GROUP_CONCAT(payment_method ORDER BY payment_date DESC), ',', 1) AS latest_method
      FROM payments
      GROUP BY invoice_id
    ) pay ON pay.invoice_id = i.id
    WHERE 1=1 ${filters.join(' ')}
    ORDER BY i.created_at DESC
    LIMIT 200`,
    params
  );

  return rows;
}

async function getInvoiceById(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      i.id,
      i.invoice_no,
      i.total_amount,
      i.discount_amount,
      i.net_amount,
      i.status,
      i.created_at,
      i.encounter_id,
      e.payment_type,
      CONCAT_WS(' ', p.first_name, p.last_name) AS patient_name,
      COALESCE(pay.total_paid, 0) AS total_paid,
      pay.latest_method
    FROM invoices i
    LEFT JOIN encounters e ON e.id = i.encounter_id
    LEFT JOIN patients p ON p.id = e.patient_id
    LEFT JOIN (
      SELECT
        invoice_id,
        SUM(amount_paid) AS total_paid,
        SUBSTRING_INDEX(GROUP_CONCAT(payment_method ORDER BY payment_date DESC), ',', 1) AS latest_method
      FROM payments
      GROUP BY invoice_id
    ) pay ON pay.invoice_id = i.id
    WHERE i.id = ?
    LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listRecentClaims() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      i.id,
      i.invoice_no,
      i.net_amount,
      i.status,
      CONCAT_WS(' ', p.first_name, p.last_name) AS patient_name,
      e.payment_type
    FROM invoices i
    LEFT JOIN encounters e ON e.id = i.encounter_id
    LEFT JOIN patients p ON p.id = e.patient_id
    WHERE e.payment_type IN ('BPJS', 'Asuransi Swasta') AND i.status IN ('Draft', 'Unpaid')
    ORDER BY i.created_at DESC
    LIMIT 6`
  );
  return rows;
}

async function createPayment({ invoiceId, paymentMethod, amountPaid, recordedBy }) {
  const pool = getPool();
  const id = crypto.randomUUID();

  await pool.execute(
    `INSERT INTO payments (id, invoice_id, payment_method, amount_paid, recorded_by)
     VALUES (?, ?, ?, ?, ?)`,
    [id, invoiceId, paymentMethod, amountPaid, recordedBy || null]
  );

  const invoice = await getInvoiceById(invoiceId);
  if (!invoice) return;

  const totalPaid = Number(invoice.total_paid || 0);
  const netAmount = Number(invoice.net_amount || 0);
  const nextStatus = totalPaid >= netAmount ? 'Paid' : 'Unpaid';

  await pool.execute('UPDATE invoices SET status = ? WHERE id = ?', [nextStatus, invoiceId]);
}

async function updateInvoiceStatus(invoiceId, status) {
  const pool = getPool();
  await pool.execute('UPDATE invoices SET status = ? WHERE id = ?', [status, invoiceId]);
}

module.exports = {
  getFinanceSummary,
  listInvoices,
  getInvoiceById,
  listRecentClaims,
  createPayment,
  updateInvoiceStatus
};
