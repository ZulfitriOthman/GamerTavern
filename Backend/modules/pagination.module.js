// Backend/modules/pagination.module.js — one shared shape for every
// paginated list endpoint, so the frontend never has to special-case a
// route's response format.
export function parsePagination(req, { defaultLimit = 20, maxLimit = 50 } = {}) {
  const page = Math.max(1, Math.trunc(Number(req.query.page)) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Math.trunc(Number(req.query.limit)) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function paginationMeta({ page, limit, total }) {
  return { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) };
}
