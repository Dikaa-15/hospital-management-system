const express = require('express');
const { requireAuth } = require('../../middlewares/auth');
const { allowRoles } = require('../../middlewares/rbac');
const { getSupabaseClient } = require('../../config/supabase');

const router = express.Router();

// Dev utility endpoint to verify Supabase connectivity.
// Recommended access: admin only.
router.get('/test-db', requireAuth, allowRoles('admin'), async (req, res) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('patients').select('*').limit(20);
    if (error) return res.status(400).json({ ok: false, message: error.message });
    return res.json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ ok: false, message: error.message });
  }
});

module.exports = router;
