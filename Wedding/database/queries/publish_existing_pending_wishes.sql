-- =============================================================================
-- OPTIONAL — publish wishes that were left 'pending' by the old approval
-- workflow. New wishes are published automatically; this is only for the
-- older ones, and only if you want them public. It never touches wishes you
-- hid or marked as spam.
--
-- Step 1: review them (read-only):
-- =============================================================================

SELECT id, name, relationship, message, created_at
FROM wedding_greetings
WHERE status = 'pending'
ORDER BY created_at;

-- =============================================================================
-- Step 2: when you are happy with the list, select and run these together:
-- =============================================================================

-- START TRANSACTION;
-- UPDATE wedding_greetings SET status = 'approved' WHERE status = 'pending';
-- COMMIT;
