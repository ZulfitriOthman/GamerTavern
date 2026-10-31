-- ================================================================
-- !! DEVELOPMENT / TEST DATA ONLY !!
-- !! DO NOT RUN AGAINST PRODUCTION !!
-- ================================================================
-- GamerTavern / NanashiCollectibles — Example Development Seed Data
-- ================================================================
-- OPTIONAL. Run this AFTER Database/All.sql (or schema/001-008) has
-- been executed, and ONLY in a development/test database. NOT
-- executed automatically.
--
-- Contains example MERCHANTS, shipping methods, and a couple of sample
-- PRODUCTS for local development and manual QA of the marketplace
-- flows. Does NOT include any real user, order, or payment data.
-- Passwords below are LITERAL PLACEHOLDER STRINGS, not real bcrypt
-- hashes — these USERS cannot log in until you either replace the
-- hash with a real one, or (recommended) register through the real
-- POST /api/auth/register + merchant registration flow instead of
-- inserting directly.
--
-- History NOTE: this exact data (merchant-a@example.test,
-- merchant-b@example.test) previously existed directly in the live
-- GamerTavern database — it was removed from production during the
-- 2026-09-14 database cleanup and moved here, where it belongs.
-- Development environments that want it back should run this file
-- explicitly, not expect it to already be present.
--
-- Select your GamerTavern database before running this script.
-- USE `your_gamertavern_schema`;

-- ============================================================
-- SHIPPING METHODS
-- ============================================================
INSERT INTO SHIPPING_METHODS (NAME, CODE, DESCRIPTION, BASE_FEE, STATUS) VALUES
  ('Pickup', 'pickup', 'Collect your order directly from the merchant.', 0.00, 'active'),
  ('Local Delivery', 'local_delivery', 'Delivery within Brunei-Muara and nearby districts.', 5.00, 'active');

-- ============================================================
-- EXAMPLE MERCHANT OWNERS (USERS) + MERCHANTS
-- ============================================================
-- NOTE: PASSWORD_HASH values below are placeholders (NOT a valid bcrypt
-- hash) — replace via the real POST /api/auth/register + merchant
-- registration flow instead of inserting directly, unless you are
-- scripting a throwaway local dev database and will overwrite these
-- rows via the application immediately after.

INSERT INTO USERS (ROLE, NAME, EMAIL, PHONE, PASSWORD_HASH, STATUS) VALUES
  ('VENDOR', 'Merchant A Owner', 'merchant-a@example.test', '+6738000001', 'REPLACE_WITH_REAL_BCRYPT_HASH', 'active'),
  ('VENDOR', 'Merchant B Owner', 'merchant-b@example.test', '+6738000002', 'REPLACE_WITH_REAL_BCRYPT_HASH', 'active');

INSERT INTO MERCHANTS (BUSINESS_NAME, DISPLAY_NAME, SLUG, CONTACT_PERSON, EMAIL, PHONE, BUSINESS_CATEGORY, STATUS) VALUES
  ('Merchant A Trading Co.', 'Merchant A', 'merchant-a', 'Merchant A Owner', 'merchant-a@example.test', '+6738000001', 'tcg', 'ACTIVE'),
  ('Merchant B Hobby Store', 'Merchant B', 'merchant-b', 'Merchant B Owner', 'merchant-b@example.test', '+6738000002', 'gunpla', 'ACTIVE');

INSERT INTO MERCHANT_USERS (MERCHANT_ID, USER_ID, ROLE, STATUS)
SELECT m.ID, u.ID, 'MERCHANT_OWNER', 'active'
FROM MERCHANTS m
JOIN USERS u ON u.EMAIL = m.EMAIL
WHERE m.SLUG IN ('merchant-a', 'merchant-b');

-- ============================================================
-- EXAMPLE PRODUCTS (requires PRODUCT_CATEGORIES from
-- Database/seeds/reference.sql to already exist)
-- ============================================================
INSERT INTO PRODUCTS (VENDOR_ID, MERCHANT_ID, CATEGORY_ID, NAME, SLUG, CODE, DESCRIPTION, PRICE, STOCK_QUANTITY, STATUS)
SELECT u.ID, m.ID, c.ID, 'Sample Booster Box', 'sample-booster-box', 'SKU-BB-001',
       'Example seed product for local development only.', 49.90, 20, 'active'
FROM USERS u
JOIN MERCHANTS m ON m.SLUG = 'merchant-a'
JOIN PRODUCT_CATEGORIES c ON c.SLUG = 'trading-card-games'
WHERE u.EMAIL = 'merchant-a@example.test';

INSERT INTO PRODUCTS (VENDOR_ID, MERCHANT_ID, CATEGORY_ID, NAME, SLUG, CODE, DESCRIPTION, PRICE, STOCK_QUANTITY, STATUS)
SELECT u.ID, m.ID, c.ID, 'Sample Gunpla Kit', 'sample-gunpla-kit', 'SKU-GK-001',
       'Example seed product for local development only.', 89.90, 10, 'active'
FROM USERS u
JOIN MERCHANTS m ON m.SLUG = 'merchant-b'
JOIN PRODUCT_CATEGORIES c ON c.SLUG = 'gunpla'
WHERE u.EMAIL = 'merchant-b@example.test';

-- ================================================================
-- END OF seed data
-- ================================================================
