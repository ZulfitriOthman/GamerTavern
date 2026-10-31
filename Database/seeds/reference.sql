-- ================================================================
-- GamerTavern / NanashiCollectibles — Reference Data Seed
-- ================================================================
-- SAFE FOR PRODUCTION. Run this AFTER Database/All.sql (or
-- schema/001-008) has been executed successfully. Contains ONLY safe,
-- non-sensitive reference/lookup data — no USERS, passwords, customer
-- data, ORDERS, payments, or fake MERCHANTS/PRODUCTS/TOURNAMENTS.
-- Every VALUE here matches the copy already shown on the live frontend
-- (NanashiCollectibles/src/config/site.js), so the site and the
-- database agree on names from the start.
--
-- Idempotency NOTE: these are plain INSERTs, not INSERT IGNORE / ON
-- DUPLICATE KEY UPDATE — running this twice against a database that
-- already has these rows will fail on the UNIQUE SLUG constraints.
-- That's intentional (fails loud rather than silently duplicating);
-- check first if you're unsure whether it's already been run.
--
-- NOT executed automatically. Review, then run manually.

-- Select your GamerTavern database before running this script.
-- USE `your_gamertavern_schema`;

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================
INSERT INTO PRODUCT_CATEGORIES (NAME, SLUG, DESCRIPTION) VALUES
  ('Trading Card Games', 'trading-card-games', 'Digimon, Pokémon, Magic: The Gathering, Vanguard, Ultraman, and more.'),
  ('TCG Accessories', 'tcg-accessories', 'Sleeves, deck boxes, binders, storage, and play accessories.'),
  ('Collectibles', 'collectibles', 'Curated collectible items across franchises.'),
  ('Gunpla', 'gunpla', 'Gunpla kits, model kits, and hobby accessories.'),
  ('Drone Parts', 'drone-parts', 'Spare parts, FPV components, batteries, and propellers.'),
  ('Computer Parts', 'computer-parts', 'Components, peripherals, and replacement parts.');

-- ============================================================
-- TCG GAMES
-- ============================================================
INSERT INTO TCG_GAMES (NAME, SLUG, STATUS) VALUES
  ('Digimon Card Game', 'digimon-card-game', 'active'),
  ('Pokémon Trading Card Game', 'pokemon-trading-card-game', 'active'),
  ('Magic: The Gathering', 'magic-the-gathering', 'active'),
  ('Cardfight!! Vanguard', 'cardfight-vanguard', 'active'),
  ('Ultraman Card Game', 'ultraman-card-game', 'active');

-- ============================================================
-- PRODUCT TYPES (Trading Card Games only, for now — see
-- Database/schema/003_catalog.sql's PRODUCT_TYPES comment; scoped per
-- CATEGORY_ID so future categories can get their own rows later)
-- ============================================================
INSERT INTO PRODUCT_TYPES (CATEGORY_ID, NAME, SLUG, SORT_ORDER)
SELECT id, v.name, v.slug, v.sort_order
  FROM PRODUCT_CATEGORIES, (
    SELECT 'Single Card' AS name, 'single-card' AS slug, 1 AS sort_order
    UNION ALL SELECT 'Booster Pack', 'booster-pack', 2
    UNION ALL SELECT 'Booster Box', 'booster-box', 3
    UNION ALL SELECT 'Starter Deck', 'starter-deck', 4
    UNION ALL SELECT 'Trial Deck', 'trial-deck', 5
    UNION ALL SELECT 'Structure Deck', 'structure-deck', 6
    UNION ALL SELECT 'Deck Set', 'deck-set', 7
    UNION ALL SELECT 'Bundle / Collection', 'bundle', 8
    UNION ALL SELECT 'Other', 'other', 9
  ) v
 WHERE PRODUCT_CATEGORIES.SLUG = 'trading-card-games';

-- ============================================================
-- ESPORTS GAMES
-- ============================================================
INSERT INTO ESPORTS_GAMES (NAME, SLUG) VALUES
  ('Apex Legends', 'apex-legends');

-- ============================================================
-- NEWS CATEGORIES
-- ============================================================
-- General, platform-wide categories — not tied to any one TCG. A
-- game-specific article should use NEWS.TCG_GAME_ID in addition to one
-- of these, not a TCG NAME as the CATEGORY itself.
INSERT INTO NEWS_CATEGORIES (NAME, SLUG) VALUES
  ('General', 'general'),
  ('TCG', 'tcg'),
  ('Esports', 'esports'),
  ('Services', 'services'),
  ('Shop', 'shop'),
  ('Technology', 'technology'),
  ('Collectibles', 'collectibles');

-- ============================================================
-- SERVICES
-- ============================================================
INSERT INTO SERVICES (NAME, SLUG, CATEGORY, SUMMARY) VALUES
  ('Drone Services', 'drone-services', 'drone', 'Aerial photography, videography, and event coverage.'),
  ('Website Development', 'website-development', 'web_development', 'Business, ecommerce, and event websites.'),
  ('Application Development', 'application-development', 'application_development', 'Web applications and internal business systems.');

-- ============================================================
-- SHIPPING METHODS
-- ============================================================
-- checkout.routes.js requires a valid, active SHIPPING_METHODS row for
-- every order (shippingMethodId) — without at least one row, checkout
-- fails for every customer. Two real, distinct methods (not the earlier
-- single "Pickup / Merchant Arranged" placeholder) so Delivery and Pickup
-- are genuine checkout choices, gating Pay on Delivery / Pay on Pickup
-- eligibility (Backend/modules/fulfilment.module.js). Add 'courier'/
-- 'international' rows later if the business wants a real shipping
-- calculator — the checkout UI already renders a real selector whenever
-- more than one active method exists.
INSERT INTO SHIPPING_METHODS (NAME, CODE, DESCRIPTION, BASE_FEE) VALUES
  ('Pickup', 'pickup', 'Collect your order directly from the merchant.', 0.00),
  ('Local Delivery', 'local_delivery', 'Delivery within Brunei-Muara and nearby districts.', 5.00);

-- ================================================================
-- END OF SEED DATA
-- 6 PRODUCT_CATEGORIES + 5 TCG_GAMES + 9 PRODUCT_TYPES + 1 ESPORTS_GAMES
-- + 7 NEWS_CATEGORIES + 3 SERVICES + 2 SHIPPING_METHODS = 33 rows total.
-- No USERS, no ORDERS, no fake business data.
-- ================================================================
