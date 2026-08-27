-- ================================================================
-- NanashiCollectibles v2 — Reference Data Seed
-- ================================================================
-- Run this AFTER Database/NanashiCollectibles_v2.sql has been executed
-- successfully. Contains ONLY safe, non-sensitive reference/lookup data —
-- no users, passwords, customer data, orders, payments, or fake
-- products/tournaments. Every value here matches the copy already shown
-- on the live frontend (NanashiCollectibles/src/config/site.js), so the
-- site and the database agree on names from the start.
--
-- NOT executed automatically. Review in MySQL Workbench, then run manually.

-- Select your NanashiCollectibles database before running this script.
-- USE `your_nanashicollectibles_schema`;

-- ============================================================
-- PRODUCT CATEGORIES
-- ============================================================
INSERT INTO product_categories (name, slug, description) VALUES
  ('Trading Card Games', 'trading-card-games', 'Digimon, Pokémon, Magic: The Gathering, Vanguard, Ultraman, and more.'),
  ('TCG Accessories', 'tcg-accessories', 'Sleeves, deck boxes, binders, storage, and play accessories.'),
  ('Collectibles', 'collectibles', 'Curated collectible items across franchises.'),
  ('Gunpla', 'gunpla', 'Gunpla kits, model kits, and hobby accessories.'),
  ('Drone Parts', 'drone-parts', 'Spare parts, FPV components, batteries, and propellers.'),
  ('Computer Parts', 'computer-parts', 'Components, peripherals, and replacement parts.');

-- ============================================================
-- TCG GAMES
-- ============================================================
INSERT INTO tcg_games (name, slug, status) VALUES
  ('Digimon Card Game', 'digimon-card-game', 'active'),
  ('Pokémon Trading Card Game', 'pokemon-trading-card-game', 'active'),
  ('Magic: The Gathering', 'magic-the-gathering', 'active'),
  ('Cardfight!! Vanguard', 'cardfight-vanguard', 'active'),
  ('Ultraman Card Game', 'ultraman-card-game', 'active');

-- ============================================================
-- ESPORTS GAMES
-- ============================================================
INSERT INTO esports_games (name, slug) VALUES
  ('Apex Legends', 'apex-legends');

-- ============================================================
-- NEWS CATEGORIES
-- ============================================================
-- General, platform-wide categories — not tied to any one TCG. A
-- game-specific article should use news.tcg_game_id in addition to one
-- of these, not a TCG name as the category itself.
INSERT INTO news_categories (name, slug) VALUES
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
INSERT INTO services (name, slug, category, summary) VALUES
  ('Drone Services', 'drone-services', 'drone', 'Aerial photography, videography, and event coverage.'),
  ('Website Development', 'website-development', 'web_development', 'Business, ecommerce, and event websites.'),
  ('Application Development', 'application-development', 'application_development', 'Web applications and internal business systems.');

-- ================================================================
-- END OF SEED DATA
-- 6 product_categories + 5 tcg_games + 1 esports_games + 7 news_categories
-- + 3 services = 22 rows total. No users, no orders, no fake business data.
-- ================================================================
