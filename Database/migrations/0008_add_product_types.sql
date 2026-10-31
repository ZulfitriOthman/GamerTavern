-- ================================================================
-- Migration 0008 — Product Types (TCG Product Type filter/field)
-- ================================================================
-- Adds a structured "what kind of product is this" field, scoped per
-- category (Single Card / Booster Box / ... under Trading Card Games),
-- distinct from PRODUCTS.TCG_GAME_ID (which game) — see
-- Database/schema/003_catalog.sql's PRODUCT_TYPES comment and
-- Backend/controllers/product.controller.js's resolveProductTypeRequirement()
-- for the full rationale.
--
-- Purely additive, idempotent, safe to re-run:
--   1. PRODUCT_TYPES — new table.
--   2. PRODUCTS.PRODUCT_TYPE_ID — new nullable column + FK + index.
--   3. Seed: 9 Trading Card Games product types (Single Card, Booster
--      Pack, Booster Box, Starter Deck, Trial Deck, Structure Deck, Deck
--      Set, Bundle / Collection, Other) — only inserted if that
--      category's PRODUCT_TYPES rows don't already exist.
--
-- NOT DONE HERE, BY DESIGN: no backfill of existing PRODUCTS rows —
-- existing products keep PRODUCT_TYPE_ID = NULL ("Unclassified") until a
-- merchant explicitly sets one via Edit Product. This migration never
-- guesses a product's type from its name/SKU/tags.
-- ================================================================

-- Select your NanashiCollectibles/GamerTavern database before running this script.
-- USE `your_gamertavern_schema`;


-- ================================================================
-- 1. PRODUCT_TYPES
-- ================================================================
CREATE TABLE IF NOT EXISTS PRODUCT_TYPES (
  ID           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  CATEGORY_ID  INT UNSIGNED NOT NULL,
  NAME         VARCHAR(100) NOT NULL,
  SLUG         VARCHAR(120) NOT NULL,
  SORT_ORDER   INT UNSIGNED NOT NULL DEFAULT 0,
  STATUS       VARCHAR(20)  NOT NULL DEFAULT 'active',
  CREATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_PRODUCT_TYPES_CATEGORY
    FOREIGN KEY (CATEGORY_ID) REFERENCES PRODUCT_CATEGORIES(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_PRODUCT_TYPES_CATEGORY_SLUG (CATEGORY_ID, SLUG),
  INDEX IDX_PRODUCT_TYPES_CATEGORY (CATEGORY_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ================================================================
-- 2. PRODUCTS.PRODUCT_TYPE_ID
-- ================================================================
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'PRODUCTS' AND COLUMN_NAME = 'PRODUCT_TYPE_ID'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE PRODUCTS
     ADD COLUMN PRODUCT_TYPE_ID INT UNSIGNED NULL AFTER TCG_GAME_ID,
     ADD CONSTRAINT FK_PRODUCTS_PRODUCT_TYPE FOREIGN KEY (PRODUCT_TYPE_ID) REFERENCES PRODUCT_TYPES(ID) ON DELETE SET NULL,
     ADD INDEX IDX_PRODUCTS_PRODUCT_TYPE (PRODUCT_TYPE_ID)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ================================================================
-- 3. Seed: Trading Card Games product types
-- ================================================================
SET @tcg_category_id := (SELECT ID FROM PRODUCT_CATEGORIES WHERE SLUG = 'trading-card-games' LIMIT 1);

INSERT INTO PRODUCT_TYPES (CATEGORY_ID, NAME, SLUG, SORT_ORDER)
SELECT @tcg_category_id, v.name, v.slug, v.sort_order
  FROM (
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
 WHERE @tcg_category_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM PRODUCT_TYPES pt WHERE pt.category_id = @tcg_category_id AND pt.slug = v.slug
   );

-- ================================================================
-- END OF Migration 0008
-- 1 new table, 1 new column + FK + index, 0 destructive statements, no
-- existing PRODUCTS row is modified.
-- ================================================================
