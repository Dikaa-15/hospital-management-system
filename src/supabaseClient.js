// Backward-compatible export.
// Prefer importing from: ./config/supabase
const { getSupabaseClient } = require('./config/supabase');

module.exports = getSupabaseClient();
