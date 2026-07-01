const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { allowRoles } = require('../../middlewares/rbac');
const { getPool } = require('../../config/database');

const router = express.Router();

// Dev utility endpoint to verify local MySQL connectivity.
// Recommended access: admin only.
router.get('/test-db', requireAuth, allowRoles('admin'), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute('SELECT * FROM patients LIMIT 20');
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
