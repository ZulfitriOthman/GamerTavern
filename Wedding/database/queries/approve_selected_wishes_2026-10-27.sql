-- =============================================================================
-- OPTIONAL — publish two specific wishes saved as 'pending' on 2026-10-27,
-- before the instant-publish update was running on the live backend:
--
--   80d4d9b3-35f1-4723-97fa-aab5a01eb9fa  Zulfitri Othman  "Testing"
--   eb2ceb6a-89f1-481b-8456-9c990bf8791f  Zulfitri Othman  "Test"
--
-- Only these exact IDs, and only while they are still 'pending' — never
-- hidden/spam records. (These look like test messages; you may prefer to delete
-- them from the admin dashboard instead.)
--
-- Step 1: review (read-only):
-- =============================================================================

SELECT id, name, message, status, created_at
FROM wedding_greetings
WHERE id IN ('80d4d9b3-35f1-4723-97fa-aab5a01eb9fa', 'eb2ceb6a-89f1-481b-8456-9c990bf8791f');

-- =============================================================================
-- Step 2: to publish them, select and run these three statements together:
-- =============================================================================

-- START TRANSACTION;
-- UPDATE wedding_greetings
--    SET status = 'approved'
--  WHERE id IN ('80d4d9b3-35f1-4723-97fa-aab5a01eb9fa', 'eb2ceb6a-89f1-481b-8456-9c990bf8791f')
--    AND status = 'pending';
-- COMMIT;
