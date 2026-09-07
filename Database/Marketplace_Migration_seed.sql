-- ================================================================
-- Marketplace Migration — Example Development Seed Data
-- ================================================================
-- OPTIONAL. Run this AFTER Database/Marketplace_Migration.sql, and only
-- in a development/test database. NOT executed automatically.
--
-- Contains example merchants, shipping methods, and a couple of sample
-- products/variants for local development and manual QA of the
-- marketplace flows. Does NOT include any real user, order, or payment
-- data. Passwords below are for two ordinary `users` rows that then get
-- linked as merchant owners — replace before using anywhere but a
-- throwaway local database.
--
-- Select your NanashiCollectibles database before running this script.
-- USE `your_nanashicollectibles_schema`;

-- ============================================================
-- SHIPPING METHODS
-- ============================================================
INSERT INTO shipping_methods (name, code, description, base_fee, status) VALUES
  ('Pickup', 'pickup', 'Collect your order directly from the merchant.', 0.00, 'active'),
  ('Local Delivery', 'local_delivery', 'Delivery within Brunei-Muara and nearby districts.', 5.00, 'active');

-- ============================================================
-- EXAMPLE MERCHANT OWNERS (users) + MERCHANTS
-- ============================================================
-- NOTE: password_hash values below are placeholders (NOT a valid bcrypt
-- hash) — replace via the real POST /api/auth/register + merchant
-- registration flow instead of inserting directly, unless you are
-- scripting a throwaway local dev database and will overwrite these
-- rows via the application immediately after.

INSERT INTO users (role, name, email, phone, password_hash, status) VALUES
  ('VENDOR', 'Merchant A Owner', 'merchant-a@example.test', '+6738000001', 'REPLACE_WITH_REAL_BCRYPT_HASH', 'active'),
  ('VENDOR', 'Merchant B Owner', 'merchant-b@example.test', '+6738000002', 'REPLACE_WITH_REAL_BCRYPT_HASH', 'active');

INSERT INTO merchants (business_name, display_name, slug, contact_person, email, phone, business_category, status) VALUES
  ('Merchant A Trading Co.', 'Merchant A', 'merchant-a', 'Merchant A Owner', 'merchant-a@example.test', '+6738000001', 'tcg', 'ACTIVE'),
  ('Merchant B Hobby Store', 'Merchant B', 'merchant-b', 'Merchant B Owner', 'merchant-b@example.test', '+6738000002', 'gunpla', 'ACTIVE');

INSERT INTO merchant_users (merchant_id, user_id, role, status)
SELECT m.id, u.id, 'MERCHANT_OWNER', 'active'
FROM merchants m
JOIN users u ON u.email = m.email
WHERE m.slug IN ('merchant-a', 'merchant-b');

-- ============================================================
-- EXAMPLE PRODUCTS (requires product_categories from
-- Database/NanashiCollectibles_v2_seed.sql to already exist)
-- ============================================================
INSERT INTO products (vendor_id, merchant_id, category_id, name, slug, code, description, price, stock_quantity, status)
SELECT u.id, m.id, c.id, 'Sample Booster Box', 'sample-booster-box', 'SKU-BB-001',
       'Example seed product for local development only.', 49.90, 20, 'active'
FROM users u
JOIN merchants m ON m.slug = 'merchant-a'
JOIN product_categories c ON c.slug = 'trading-card-games'
WHERE u.email = 'merchant-a@example.test';

INSERT INTO products (vendor_id, merchant_id, category_id, name, slug, code, description, price, stock_quantity, status)
SELECT u.id, m.id, c.id, 'Sample Gunpla Kit', 'sample-gunpla-kit', 'SKU-GK-001',
       'Example seed product for local development only.', 89.90, 10, 'active'
FROM users u
JOIN merchants m ON m.slug = 'merchant-b'
JOIN product_categories c ON c.slug = 'gunpla'
WHERE u.email = 'merchant-b@example.test';

-- ================================================================
-- END OF seed data
-- ================================================================
