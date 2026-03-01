const crypto = require('crypto');
const { getPool } = require('../../config/database');

function buildWhere({ q = '', category = '', stock = '' }) {
  const where = [];
  const params = [];

  if (q) {
    const like = `%${q}%`;
    where.push('(i.item_name LIKE ? OR i.item_code LIKE ? OR b.batch_number LIKE ?)');
    params.push(like, like, like);
  }

  if (category) {
    where.push('COALESCE(i.category_id, "") = ?');
    params.push(category);
  }

  if (stock === 'low') {
    where.push('COALESCE(s.current_stock, 0) < i.min_stock');
  }
  if (stock === 'safe') {
    where.push('COALESCE(s.current_stock, 0) >= i.min_stock');
  }
  if (stock === 'expiring') {
    where.push('s.nearest_expiry IS NOT NULL AND s.nearest_expiry <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)');
  }

  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

async function getInventorySummary() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT
      (SELECT COUNT(*) FROM inventory_items WHERE is_active = 1) AS total_items,
      (SELECT COUNT(*)
       FROM inventory_items i
       LEFT JOIN (
         SELECT item_id, SUM(current_qty) AS stock
         FROM inventory_batches
         GROUP BY item_id
       ) s ON s.item_id = i.id
       WHERE i.is_active = 1 AND COALESCE(s.stock, 0) < i.min_stock) AS low_stock_alerts,
      (SELECT COUNT(*)
       FROM inventory_batches
       WHERE expiry_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)) AS expiring_soon,
      (SELECT COALESCE(SUM(amount_paid), 0)
       FROM payments
       WHERE DATE(payment_date) = CURDATE()) AS daily_dispensed_proxy`
  );
  return rows[0] || { total_items: 0, low_stock_alerts: 0, expiring_soon: 0, daily_dispensed_proxy: 0 };
}

async function listInventoryItems(filters = {}) {
  const pool = getPool();
  const { clause, params } = buildWhere(filters);

  const [rows] = await pool.execute(
    `SELECT
      i.id,
      i.item_code,
      i.item_name,
      i.category_id,
      i.base_unit,
      i.min_stock,
      i.is_active,
      COALESCE(s.current_stock, 0) AS current_stock,
      s.nearest_expiry,
      s.batches_count
    FROM inventory_items i
    LEFT JOIN (
      SELECT
        b.item_id,
        SUM(b.current_qty) AS current_stock,
        MIN(b.expiry_date) AS nearest_expiry,
        COUNT(*) AS batches_count
      FROM inventory_batches b
      GROUP BY b.item_id
    ) s ON s.item_id = i.id
    LEFT JOIN inventory_batches b ON b.item_id = i.id
    ${clause}
    GROUP BY
      i.id, i.item_code, i.item_name, i.category_id, i.base_unit, i.min_stock, i.is_active,
      s.current_stock, s.nearest_expiry, s.batches_count
    ORDER BY i.item_name ASC
    LIMIT 300`,
    params
  );

  return rows;
}

async function getItemById(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, item_code, item_name, category_id, base_unit, min_stock, is_active
     FROM inventory_items
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function getItemBatches(itemId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, item_id, location_id, batch_number, expiry_date, current_qty, updated_at
     FROM inventory_batches
     WHERE item_id = ?
     ORDER BY updated_at DESC
     LIMIT 50`,
    [itemId]
  );
  return rows;
}

async function listCategories() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT DISTINCT category_id
     FROM inventory_items
     WHERE category_id IS NOT NULL AND category_id <> ''
     ORDER BY category_id ASC`
  );
  return rows.map((r) => r.category_id);
}

async function createInventoryItem(payload) {
  const pool = getPool();
  const id = crypto.randomUUID();

  await pool.execute(
    `INSERT INTO inventory_items (
      id, item_code, item_name, category_id, base_unit, min_stock, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.itemCode,
      payload.itemName,
      payload.categoryId || null,
      payload.baseUnit,
      payload.minStock,
      payload.isActive ? 1 : 0
    ]
  );

  return getItemById(id);
}

async function updateInventoryItem(id, payload) {
  const pool = getPool();
  await pool.execute(
    `UPDATE inventory_items
     SET item_code = ?,
         item_name = ?,
         category_id = ?,
         base_unit = ?,
         min_stock = ?,
         is_active = ?
     WHERE id = ?`,
    [
      payload.itemCode,
      payload.itemName,
      payload.categoryId || null,
      payload.baseUnit,
      payload.minStock,
      payload.isActive ? 1 : 0,
      id
    ]
  );
  return getItemById(id);
}

async function setItemActiveState(id, isActive) {
  const pool = getPool();
  await pool.execute('UPDATE inventory_items SET is_active = ? WHERE id = ?', [isActive ? 1 : 0, id]);
}

async function createInventoryBatch(payload) {
  const pool = getPool();
  const id = crypto.randomUUID();

  await pool.execute(
    `INSERT INTO inventory_batches (
      id, item_id, location_id, batch_number, expiry_date, current_qty
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.itemId,
      payload.locationId || null,
      payload.batchNumber,
      payload.expiryDate,
      payload.currentQty
    ]
  );
}

module.exports = {
  getInventorySummary,
  listInventoryItems,
  getItemById,
  getItemBatches,
  listCategories,
  createInventoryItem,
  updateInventoryItem,
  setItemActiveState,
  createInventoryBatch
};
