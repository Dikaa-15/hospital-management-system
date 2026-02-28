const { getPool } = require('../../config/database');

let lastWarnAt = 0;

function getErrorMessage(error) {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function logAuditEvent({ actorUserId = null, action, objectType = null, objectId = null, metadata = null }) {
  if (!action) return;
  if ((process.env.AUDIT_LOG_ENABLED || 'true').toLowerCase() !== 'true') return;

  try {
    const pool = getPool();
    await pool.execute(
      `INSERT INTO audit_logs (actor_user_id, action, object_type, object_id, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        actorUserId,
        action,
        objectType,
        objectId,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  } catch (error) {
    // Audit log failure should never break user flow.
    const now = Date.now();
    if (now - lastWarnAt > 10000) {
      lastWarnAt = now;
      console.warn('[audit] failed to persist log:', getErrorMessage(error));
    }
  }
}

module.exports = { logAuditEvent };
