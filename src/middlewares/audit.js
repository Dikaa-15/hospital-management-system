const { logAuditEvent } = require('../modules/audit/audit.service');

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function inferObjectType(pathname = '') {
  if (pathname.includes('inventory')) return 'inventory';
  if (pathname.includes('financial') || pathname.includes('billing')) return 'billing';
  if (pathname.includes('patient')) return 'patient';
  if (pathname.includes('user') || pathname.includes('doctor') || pathname.includes('staff')) return 'user';
  if (pathname.includes('schedule') || pathname.includes('ward')) return 'schedule';
  if (pathname.includes('settings') || pathname.includes('security')) return 'system';
  return null;
}

function auditMutations(req, res, next) {
  if (!MUTATION_METHODS.has(req.method)) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    if (!req.session?.user) return;

    void logAuditEvent({
      actorUserId: req.session.user.id || null,
      action: `mutation.${req.method.toLowerCase()}`,
      objectType: inferObjectType(req.path),
      objectId: null,
      metadata: {
        path: req.path,
        query: req.query || {},
        statusCode: res.statusCode
      }
    });
  });

  return next();
}

module.exports = { auditMutations };
