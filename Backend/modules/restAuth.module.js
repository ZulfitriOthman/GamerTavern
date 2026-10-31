// Backend/modules/restAuth.module.js
//
// Shared Express-side identity/authorization helpers for the marketplace
// REST routes (merchant, cart, checkout, orders, wishlist, reviews).
// Mirrors the philosophy of modules/authz.module.js (Socket.IO): identity
// always comes from a verified JWT, never from a client-supplied field.
//
// Kept separate from routes/api/auth.routes.js's inline requireAuth so it
// can be reused across every new route file without duplicating it or
// modifying the existing, working auth route.
import { verifyToken } from "./jwt.module.js";

export function requireAuth(req, res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Missing token." });

  try {
    req.user = verifyToken(token); // { sub, email, name, role, iat, exp }
    return next();
  } catch {
    return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Invalid or expired token." });
  }
}

// Populates req.user when a valid token is present, but never rejects the
// request — used where guests are allowed (e.g. cart) but an authenticated
// user should still be recognized when logged in.
export function optionalAuth(req, _res, next) {
  const hdr = req.headers.authorization || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : null;
  if (!token) return next();

  try {
    req.user = verifyToken(token);
  } catch {
    req.user = null;
  }
  return next();
}

const MERCHANT_ROLE_RANK = {
  MERCHANT_EMPLOYEE: 1,
  MERCHANT_ADMIN: 2,
  MERCHANT_OWNER: 3,
};

// Resolves every merchant this authenticated user belongs to. Always a
// fresh DB read — never cached in the JWT — so a suspension or role
// change takes effect on the very next request.
export async function getMerchantMemberships(db, userId) {
  const [rows] = await db.query(
    `SELECT mu.merchant_id, mu.role, mu.status AS membership_status,
            m.business_name, m.display_name, m.slug, m.status AS merchant_status
       FROM MERCHANT_USERS mu
       JOIN MERCHANTS m ON m.id = mu.merchant_id
      WHERE mu.user_id = ?`,
    [userId]
  );
  return rows || [];
}

// Express middleware factory: requires the caller to be an ACTIVE member
// of an ACTIVE merchant with at least `minRole` seniority, and to specify
// which merchant via `?merchantId=` (or a matching route param) ONLY as a
// selector among memberships this user actually holds — it is never
// trusted as authority on its own. Sets req.merchantContext = { merchantId, role }.
//
// `allowReadOnlyWhenSuspended`: a SUSPENDED merchant (unlike BANNED/PENDING/
// REJECTED) is under investigation, not permanently gone — per the admin
// spec, read-only access to its own records should remain available rather
// than hiding everything. Pass this on GET-only routes (dashboard, product/
// order reads, settings/staff reads); every mutating route (order status,
// settings, bank details, staff writes) must NOT pass it, so a suspended
// merchant can view but never act.
export function requireMerchant(minRole = "MERCHANT_EMPLOYEE", { allowReadOnlyWhenSuspended = false } = {}) {
  return async function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Authentication required." });
    }

    try {
      const memberships = await req.db_getMerchantMemberships(req.user.sub);
      if (!memberships.length) {
        return res.status(403).json({ success: false, code: "NOT_A_MERCHANT", message: "No merchant account found for this user." });
      }

      const requestedMerchantId = req.params.merchantId
        ? Number(req.params.merchantId)
        : req.query.merchantId
        ? Number(req.query.merchantId)
        : null;

      const membership = requestedMerchantId
        ? memberships.find((m) => Number(m.merchant_id) === requestedMerchantId)
        : memberships[0];

      if (!membership) {
        return res.status(403).json({ success: false, code: "FORBIDDEN", message: "You are not a member of this merchant." });
      }
      if (membership.membership_status !== "active") {
        return res.status(403).json({ success: false, code: "MEMBERSHIP_SUSPENDED", message: "Your access to this merchant has been suspended." });
      }
      if (membership.merchant_status !== "ACTIVE") {
        const readOnlyAllowed =
          allowReadOnlyWhenSuspended && membership.merchant_status === "SUSPENDED" && req.method === "GET";
        if (!readOnlyAllowed) {
          return res.status(403).json({
            success: false,
            code: "MERCHANT_NOT_ACTIVE",
            message: `This merchant account is ${membership.merchant_status}.`,
          });
        }
      }
      if ((MERCHANT_ROLE_RANK[membership.role] || 0) < (MERCHANT_ROLE_RANK[minRole] || 0)) {
        return res.status(403).json({ success: false, code: "INSUFFICIENT_ROLE", message: `Requires ${minRole} or higher.` });
      }

      req.merchantContext = {
        merchantId: Number(membership.merchant_id),
        role: membership.role,
        businessName: membership.business_name,
        merchantStatus: membership.merchant_status,
      };
      return next();
    } catch (err) {
      console.error("[restAuth][requireMerchant] error:", err);
      return res.status(500).json({ success: false, message: "Failed to resolve merchant context." });
    }
  };
}

// Attaches a bound getMerchantMemberships(userId) helper onto every
// request so requireMerchant() above doesn't need `db` threaded through
// middleware factory arguments at mount time.
export function withMerchantMembershipsLookup(db) {
  return (req, _res, next) => {
    req.db_getMerchantMemberships = (userId) => getMerchantMemberships(db, userId);
    next();
  };
}
