// Backend/modules/auditLog.module.js
//
// Best-effort audit trail writer. Never throws — a logging failure must
// never break the request it's describing — and never accepts secrets
// in `metadata` (callers must pre-mask/omit anything sensitive; this
// module does not attempt to scrub what it's given beyond that contract).
export async function writeAuditLog(db, { actorUserId = null, actorMerchantId = null, action, entityType, entityId, metadata = null }) {
  try {
    await db.execute(
      `INSERT INTO audit_logs (actor_user_id, actor_merchant_id, action, entity_type, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [actorUserId, actorMerchantId, action, entityType, String(entityId), metadata ? JSON.stringify(metadata) : null]
    );
  } catch (err) {
    console.error(`[auditLog] failed to record ${action} for ${entityType}:${entityId}`, err?.message || err);
  }
}
