// Backend/modules/rateLimiter.module.js
//
// Minimal in-memory fixed-window rate limiter — no external dependency, since
// none currently exists in this project (no express-rate-limit or similar).
// Single-process only (state isn't shared across instances); fine for this
// backend's current deployment.
const buckets = new Map();

export function checkRateLimit(key, { max, windowMs }) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { allowed: true };
  }

  if (bucket.count >= max) {
    return { allowed: false };
  }

  bucket.count += 1;
  return { allowed: true };
}

// Periodic sweep so the map doesn't grow unbounded on a long-running process.
setInterval(
  () => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (now - bucket.start > 60 * 60 * 1000) buckets.delete(key);
    }
  },
  10 * 60 * 1000
).unref();
