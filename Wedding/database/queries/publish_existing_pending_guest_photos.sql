-- =============================================================================
-- OPTIONAL — publish guest photos that were uploaded under the old approval
-- workflow and are still waiting in 'pending'.
--
-- New guest uploads are published automatically; this script is ONLY for the
-- older pending ones, and only if you decide you want them public. It never
-- touches 'rejected' photos or official photos.
--
-- Step 1: review what would be published (read-only):
-- =============================================================================

SELECT id, uploader_name, caption, created_at
FROM wedding_photos
WHERE source = 'guest' AND status = 'pending'
ORDER BY created_at;

-- =============================================================================
-- Step 2: when you are happy with the list above, select and run the three
-- statements below together (auto-commit ON, or keep the COMMIT).
-- =============================================================================

-- START TRANSACTION;
-- UPDATE wedding_photos SET status = 'approved' WHERE source = 'guest' AND status = 'pending';
-- COMMIT;
