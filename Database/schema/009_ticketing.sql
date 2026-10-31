-- ================================================================
-- 009 — TICKETING (concert/event seat selection and booking)
-- ================================================================
-- Deliberately kept SEPARATE from ORDERS/MERCHANT_ORDERS/ORDER_ITEMS
-- (see 005_orders_checkout.sql) — ticket inventory, hold expiry, seat
-- allocation, and admission semantics are different enough from
-- merchandise checkout that unifying them would complicate both.
-- PaymentService (Backend/services/payment/PaymentService.js) IS
-- reused as-is (it's provider/domain-agnostic — never touches the DB
-- or references ORDERS/PAYMENT_TRANSACTIONS itself), but
-- PAYMENT_TRANSACTIONS itself cannot be reused: its ORDER_ID is
-- NOT NULL and FK-bound to ORDERS specifically. TICKET_PAYMENT_TRANSACTIONS
-- below mirrors its exact shape against TICKET_ORDERS instead, rather
-- than faking ecommerce orders or loosening the existing table's FK.
--
-- Two-layer model, on purpose:
--   VENUE_LAYOUTS / VENUE_SECTIONS / VENUE_SEATS = physical venue
--     geometry — reusable across every event held at that venue.
--     Never carries price, availability, or hold state.
--   EVENTS / TICKET_TYPES / EVENT_SECTIONS / EVENT_SEATS = one
--     specific show's inventory, pricing, and live status layered on
--     top of that reusable geometry. The same physical seat can be
--     VIP-priced for one event and blocked for production holds on
--     another without touching VENUE_SEATS at all.
--   TICKET_HOLD_SESSIONS / TICKET_HOLDS = a customer's in-progress
--     basket. One session groups every seat + GA line the customer
--     selected together, so the whole basket expires as one unit
--     instead of N independently-ticking timers.
--   TICKET_ORDERS / TICKET_ORDER_ITEMS / TICKET_PAYMENT_TRANSACTIONS /
--     EVENT_TICKETS = the completed purchase and the individually
--     scannable admissions it produces.
--
-- GENERAL ADMISSION is capacity-based, not 600 fake individual seats:
-- EVENT_SECTIONS.HELD_QUANTITY / SOLD_QUANTITY on the GA section row
-- is the same kind of atomically-locked counter PRODUCTS.STOCK_QUANTITY
-- already is elsewhere in this schema.
--
-- CONCURRENCY — deterministic lock order (documented here because it
-- is a cross-table invariant every hold/release/settle code path in
-- Stage 3 must follow identically, not something one table's own
-- definition can enforce):
--   1. Normalize the request: sort requested EVENT_SECTION_IDs
--      ascending, then sort requested EVENT_SEAT_IDs ascending.
--   2. Within ONE transaction, lock EVENT_SECTIONS rows first (ascending
--      ID), THEN EVENT_SEATS rows (ascending ID):
--        SELECT ... FROM EVENT_SECTIONS WHERE ID IN (...) ORDER BY ID FOR UPDATE;
--        SELECT ... FROM EVENT_SEATS    WHERE ID IN (...) ORDER BY ID FOR UPDATE;
--      Every code path that can touch both GA and reserved resources in
--      the same request (hold-create, expiry sweep touching a mixed
--      session, settle) must acquire locks in this exact
--      sections-then-seats, ascending-ID order — two transactions
--      never legitimately need the reverse order, which is what
--      prevents a circular-wait deadlock between them.
--   3. Verify EVERY requested resource is actually available (seat
--      STATUS = 'available', or GA capacity - held - sold >= requested
--      quantity) before changing anything. If even one requested seat
--      is unavailable, the whole request fails and ZERO seats are held
--      — no partial hold. This is intentional for the first
--      implementation; a deliberate partial-hold mode is a future
--      decision, not a default.
--   4. Only after every check passes: insert the TICKET_HOLD_SESSIONS +
--      TICKET_HOLDS rows and flip EVENT_SEATS.STATUS/EVENT_SECTIONS
--      counters, then COMMIT, THEN emit the Socket.IO update — never
--      the other way around. A rollback must never be preceded by an
--      emit.
--
-- IDEMPOTENT RELEASE — expiry (worker), user cancellation, checkout
-- failure, and admin intervention can all race to release the same
-- hold. Every release path uses a conditional UPDATE, never a blind
-- one, so only the first actually changes anything:
--   Session:  UPDATE TICKET_HOLD_SESSIONS SET STATUS='EXPIRED', ...
--               WHERE ID = ? AND STATUS = 'ACTIVE';
--             -- affectedRows = 0 means someone already handled it — stop.
--   Seat:     UPDATE EVENT_SEATS SET STATUS='available', CURRENT_HOLD_ID=NULL
--               WHERE ID = ? AND CURRENT_HOLD_ID = ?;
--             -- the CURRENT_HOLD_ID match means this only clears the
--             -- seat if it still belongs to THIS hold — a seat already
--             -- re-held by someone else, or already sold, is untouched.
--   GA:       UPDATE EVENT_SECTIONS SET HELD_QUANTITY = HELD_QUANTITY - ?
--               WHERE ID = ? AND HELD_QUANTITY >= ?;
--             -- the >= guard makes a double-decrement affect 0 rows
--             -- instead of underflowing INT UNSIGNED.
--
-- SOCKET.IO — broadcast only AFTER the transaction above commits,
-- matching this codebase's existing io.emit(event, payload) convention
-- (flat broadcast, no rooms — see product.controller.js). Event names,
-- lowercase/underscore after the colon, same as product:created /
-- inventory:updated: ticket:seat_held, ticket:seat_released,
-- ticket:seat_sold, ticket:inventory_updated (GA). The database is
-- always authoritative; a missed/duplicate socket message must never
-- corrupt inventory — a client reconnecting or simply refreshing always
-- refetches real state instead of trusting its last-seen socket state.
--
-- No DB-level CHECK constraint is used to enforce the "exactly one of
-- EVENT_SEAT_ID / EVENT_SECTION_ID" shape on TICKET_HOLDS /
-- TICKET_ORDER_ITEMS below — matching this schema's documented policy
-- (Database/README.md "Supported engine": no CHECK constraints
-- anywhere, engine version not confirmed) of enforcing shape/business
-- rules in application code, not DB constraints, beyond FK/UNIQUE/NOT
-- NULL.
--
-- EVENT INVENTORY GENERATION — nobody hand-creates 1,560 EVENT_SEATS
-- per concert. A Stage 3 backend service, given an EVENT_ID (whose
-- EVENTS.VENUE_LAYOUT_ID is already set) and a VENUE_SECTIONS.CATEGORY
-- -> TICKET_TYPES.ID mapping, runs ONE transaction that:
--   1. For every VENUE_SECTIONS row under that layout: upsert one
--      EVENT_SECTIONS row (EVENT_ID, SECTION_ID, TICKET_TYPE_ID) —
--      UQ_EVENT_SECTIONS_EVENT_SECTION makes re-running this a no-op.
--   2. For every VENUE_SEATS row under a non-GA VENUE_SECTIONS: upsert
--      one EVENT_SEATS row (EVENT_ID, VENUE_SEAT_ID, TICKET_TYPE_ID,
--      STATUS='available') — UQ_EVENT_SEATS_EVENT_VENUE_SEAT makes this
--      idempotent the same way. GA sections get no EVENT_SEATS rows at
--      all (see the two-layer model note above).
--   3. Both steps run in the SAME transaction — a failure partway
--      through leaves nothing half-initialized for that event.
-- Physical VENUE_SEATS are authored once per venue and reused forever;
-- EVENT_SEATS are generated fresh per event from them.
-- ================================================================

CREATE TABLE VENUE_LAYOUTS (
  ID               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  NAME             VARCHAR(150) NOT NULL,
  SLUG             VARCHAR(180) NOT NULL,
  CANVAS_WIDTH     INT UNSIGNED NOT NULL,                 -- reference coordinate space for every X/Y below, e.g. 1600
  CANVAS_HEIGHT    INT UNSIGNED NOT NULL,                 -- e.g. 1200
  LAYOUT_ELEMENTS  LONGTEXT NULL,                          -- JSON-encoded, app-validated: non-seat wayfinding geometry (stage, wings, FOH, aisles, entrances, exits, egress routes) as [{type, label, x, y, width, height, ...}]
  TOTAL_CAPACITY   INT UNSIGNED NOT NULL,                  -- redundant integrity reference = SUM of this layout's VENUE_SECTIONS.CAPACITY; reconciled by application code on section create/update, not a generated column (sections can be added/edited independently)
  STATUS           VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | draft | archived — app-validated
  CREATED_AT       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY UQ_VENUE_LAYOUTS_SLUG (SLUG)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE VENUE_SECTIONS (
  ID               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  VENUE_LAYOUT_ID  INT UNSIGNED NOT NULL,
  CODE             VARCHAR(20)  NOT NULL,                  -- short code used in seat IDs, e.g. 'A' | 'GA'
  NAME             VARCHAR(100) NOT NULL,                  -- e.g. 'Section A', 'Standing Floor'
  CATEGORY         VARCHAR(20)  NOT NULL,                  -- 'vip' | 'standard' | 'general_admission' — app-validated; drives default styling/ticket-type matching, not sale state
  CAPACITY         INT UNSIGNED NOT NULL,                  -- authoritative seat/standing count for this section (390 for a reserved section, 600 for GA)
  ROWS_COUNT       INT UNSIGNED NULL,                      -- NULL for GA (no rows). For a reserved section using a uniform grid at generation time, e.g. 13 — NOT enforced against VENUE_SEATS; irregular/edited layouts may not satisfy ROWS_COUNT * SEATS_PER_ROW = CAPACITY
  SEATS_PER_ROW    INT UNSIGNED NULL,                      -- NULL for GA or an irregular section, e.g. 30
  POSITION_X       INT NOT NULL,                           -- geometry in the parent VENUE_LAYOUTS.CANVAS_WIDTH/HEIGHT coordinate space
  POSITION_Y       INT NOT NULL,
  WIDTH            INT UNSIGNED NOT NULL,
  HEIGHT           INT UNSIGNED NOT NULL,
  SORT_ORDER       INT UNSIGNED NOT NULL DEFAULT 0,
  STATUS           VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | disabled — venue-level (this section never sells at this venue); event-level disabling is EVENT_SECTIONS.IS_DISABLED
  CREATED_AT       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_VENUE_SECTIONS_LAYOUT
    FOREIGN KEY (VENUE_LAYOUT_ID) REFERENCES VENUE_LAYOUTS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_VENUE_SECTIONS_LAYOUT_CODE (VENUE_LAYOUT_ID, CODE),
  INDEX IDX_VENUE_SECTIONS_LAYOUT (VENUE_LAYOUT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE VENUE_SEATS (
  ID                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, -- stable DB seat ID — never changes even if the human-readable code is regenerated
  SECTION_ID           INT UNSIGNED NOT NULL,
  ROW_LABEL            VARCHAR(10) NOT NULL,                -- e.g. '01' — VARCHAR so future alpha rows ('AA') are representable without a schema change
  SEAT_NUMBER          VARCHAR(10) NOT NULL,                -- e.g. '01'
  SEAT_CODE            VARCHAR(40) NOT NULL,                -- deterministic human-readable ID, e.g. 'VIP-A-R01-S01' — computed once at generation time and stored, not derived on every read
  POSITION_X           INT NOT NULL,                        -- per-seat geometry, same coordinate space as VENUE_SECTIONS; generated from ROWS_COUNT/SEATS_PER_ROW grid math at creation time but stored per-seat so an individual seat can later be moved/adjusted for an irregular layout
  POSITION_Y           INT NOT NULL,
  IS_ACCESSIBLE        TINYINT(1)  NOT NULL DEFAULT 0,      -- metadata on the seat itself, not a separate ticket type or spatial zone
  ACCESSIBILITY_TYPE   VARCHAR(30) NULL,                     -- reserved for future use, e.g. 'wheelchair' | 'companion' | 'ambulatory' — unused/NULL for the current implementation
  COMPANION_SEAT_ID    INT UNSIGNED NULL,                    -- reserved for future use: pairs an accessible seat with its adjacent companion seat
  IS_OBSTRUCTED_VIEW   TINYINT(1)  NOT NULL DEFAULT 0,
  STATUS               VARCHAR(20) NOT NULL DEFAULT 'active', -- active | removed — physical seat existence (e.g. removed during a venue renovation), never event sale state
  CREATED_AT           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_VENUE_SEATS_SECTION
    FOREIGN KEY (SECTION_ID) REFERENCES VENUE_SECTIONS(ID) ON DELETE CASCADE,
  CONSTRAINT FK_VENUE_SEATS_COMPANION
    FOREIGN KEY (COMPANION_SEAT_ID) REFERENCES VENUE_SEATS(ID) ON DELETE SET NULL,
  UNIQUE KEY UQ_VENUE_SEATS_SECTION_ROW_SEAT (SECTION_ID, ROW_LABEL, SEAT_NUMBER),
  UNIQUE KEY UQ_VENUE_SEATS_CODE (SEAT_CODE),
  INDEX IDX_VENUE_SEATS_SECTION (SECTION_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE EVENTS (
  ID                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  VENUE_LAYOUT_ID      INT UNSIGNED NOT NULL,
  NAME                 VARCHAR(255) NOT NULL,
  SLUG                 VARCHAR(280) NOT NULL,               -- powers /events/:eventSlug
  SHORT_DESCRIPTION    VARCHAR(500) NULL,
  DESCRIPTION          LONGTEXT NULL,
  BANNER_IMAGE_URL     LONGTEXT NULL,
  VENUE_NAME           VARCHAR(255) NULL,                   -- display text; no dedicated VENUES table exists yet in this schema
  VENUE_ADDRESS        VARCHAR(500) NULL,
  START_AT             TIMESTAMP NOT NULL,
  END_AT               TIMESTAMP NULL,
  DOORS_OPEN_AT        TIMESTAMP NULL,
  PER_CUSTOMER_LIMIT   INT UNSIGNED NOT NULL DEFAULT 8,      -- default max tickets per customer across every ticket type on this event; TICKET_TYPES.MAX_PER_CUSTOMER can override per type
  STATUS               VARCHAR(20) NOT NULL DEFAULT 'draft', -- draft | published | cancelled | archived — app-validated; page/listing visibility
  SALE_STATUS          VARCHAR(20) NOT NULL DEFAULT 'not_open', -- not_open | on_sale | paused | sold_out | closed — app-validated; ticket-sale gating, independent of STATUS
  SALE_STARTS_AT       TIMESTAMP NULL,
  SALE_ENDS_AT         TIMESTAMP NULL,
  CREATED_AT           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_EVENTS_VENUE_LAYOUT
    FOREIGN KEY (VENUE_LAYOUT_ID) REFERENCES VENUE_LAYOUTS(ID) ON DELETE RESTRICT,
  UNIQUE KEY UQ_EVENTS_SLUG (SLUG),
  INDEX IDX_EVENTS_STATUS (STATUS),
  INDEX IDX_EVENTS_SALE_STATUS (SALE_STATUS),
  INDEX IDX_EVENTS_START_AT (START_AT)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- VENUE_LAYOUT_ID uses ON DELETE RESTRICT: a reusable layout can't be
-- hard-deleted while any event still references it.

CREATE TABLE TICKET_TYPES (
  ID                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  EVENT_ID           INT UNSIGNED NOT NULL,
  CODE               VARCHAR(20)  NOT NULL,                 -- 'VIP' | 'STANDARD' | 'GA' — app-validated. Accessible seats are NOT a separate ticket type; IS_ACCESSIBLE is seat metadata (see VENUE_SEATS) under whichever type its section sells as.
  NAME               VARCHAR(100) NOT NULL,                 -- e.g. 'VIP / Premium'
  DESCRIPTION        VARCHAR(500) NULL,
  CATEGORY           VARCHAR(20)  NOT NULL,                 -- 'vip' | 'standard' | 'general_admission' — mirrors VENUE_SECTIONS.CATEGORY for matching
  PRICE              DECIMAL(10,2) NOT NULL,
  COLOR_TOKEN        VARCHAR(30)  NULL,                      -- semantic frontend token name this type displays as, e.g. 'gold' | 'success' | 'signal' — admin-configurable, never hardcoded per section letter in frontend code
  MAX_PER_CUSTOMER   INT UNSIGNED NULL,                      -- overrides EVENTS.PER_CUSTOMER_LIMIT for this type when set
  SORT_ORDER         INT UNSIGNED NOT NULL DEFAULT 0,
  STATUS             VARCHAR(20)  NOT NULL DEFAULT 'active', -- active | hidden — app-validated; "sold out" is computed from EVENT_SEATS/EVENT_SECTIONS, never stored here
  CREATED_AT         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_TICKET_TYPES_EVENT
    FOREIGN KEY (EVENT_ID) REFERENCES EVENTS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_TICKET_TYPES_EVENT_CODE (EVENT_ID, CODE),
  INDEX IDX_TICKET_TYPES_EVENT (EVENT_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-event configuration/inventory row for one VENUE_SECTIONS. Added
-- beyond the originally suggested table list because GENERAL ADMISSION
-- has no individual seats to hold state in EVENT_SEATS — its
-- HELD_QUANTITY/SOLD_QUANTITY counters here ARE the GA inventory,
-- locked with the same SELECT ... FOR UPDATE transaction pattern
-- PRODUCTS.STOCK_QUANTITY already uses. For reserved sections (VIP /
-- STANDARD) these two counters stay unused (0) — authoritative
-- per-seat state lives in EVENT_SEATS instead; this row still carries
-- the event's ticket-type/price mapping and an event-specific disable
-- flag for that section.
CREATE TABLE EVENT_SECTIONS (
  ID                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  EVENT_ID            INT UNSIGNED NOT NULL,
  SECTION_ID          INT UNSIGNED NOT NULL,
  TICKET_TYPE_ID      INT UNSIGNED NOT NULL,
  CAPACITY_OVERRIDE   INT UNSIGNED NULL,                     -- NULL = use VENUE_SECTIONS.CAPACITY; set lower to reduce sellable capacity for this event only (e.g. a production hold)
  HELD_QUANTITY       INT UNSIGNED NOT NULL DEFAULT 0,       -- GA only — active-hold quantity; always 0 for reserved sections
  SOLD_QUANTITY       INT UNSIGNED NOT NULL DEFAULT 0,       -- GA only — confirmed-sold quantity; always 0 for reserved sections
  IS_DISABLED         TINYINT(1) NOT NULL DEFAULT 0,          -- this section not sold for this specific event
  CREATED_AT          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_EVENT_SECTIONS_EVENT
    FOREIGN KEY (EVENT_ID) REFERENCES EVENTS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_EVENT_SECTIONS_SECTION
    FOREIGN KEY (SECTION_ID) REFERENCES VENUE_SECTIONS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_EVENT_SECTIONS_TICKET_TYPE
    FOREIGN KEY (TICKET_TYPE_ID) REFERENCES TICKET_TYPES(ID) ON DELETE RESTRICT,
  UNIQUE KEY UQ_EVENT_SECTIONS_EVENT_SECTION (EVENT_ID, SECTION_ID),
  INDEX IDX_EVENT_SECTIONS_TICKET_TYPE (TICKET_TYPE_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- EVENT_ID uses ON DELETE RESTRICT (not CASCADE): this row carries real
-- GA sales counters for reserved-adjacent bookkeeping — same
-- financial-record protection ORDER_ITEMS.ORDER_ID already gets.

-- Per-event, per-physical-seat inventory row — ONLY created for
-- reserved sections (VIP/STANDARD); GENERAL ADMISSION has no rows here
-- at all (see EVENT_SECTIONS above). This is the row that gets
-- SELECT ... FOR UPDATE locked when a hold is requested — the same
-- concurrency primitive checkout.routes.js already uses for PRODUCTS.
CREATE TABLE EVENT_SEATS (
  ID                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  EVENT_ID          INT UNSIGNED NOT NULL,
  VENUE_SEAT_ID     INT UNSIGNED NOT NULL,
  TICKET_TYPE_ID    INT UNSIGNED NOT NULL,
  PRICE_OVERRIDE    DECIMAL(10,2) NULL,                      -- NULL = use TICKET_TYPES.PRICE; set for per-seat pricing (e.g. a discounted obstructed-view seat)
  STATUS            VARCHAR(20) NOT NULL DEFAULT 'available', -- available | held | sold | blocked | unavailable — app-validated. blocked = admin/production hold, unavailable = e.g. not offered this event
  CURRENT_HOLD_ID   INT UNSIGNED NULL,                        -- the specific active TICKET_HOLDS row currently owning this seat, if any (used for the idempotent-release check — see file header)
  ORDER_ITEM_ID     INT UNSIGNED NULL,                        -- set once sold
  CREATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_EVENT_SEATS_EVENT
    FOREIGN KEY (EVENT_ID) REFERENCES EVENTS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_EVENT_SEATS_VENUE_SEAT
    FOREIGN KEY (VENUE_SEAT_ID) REFERENCES VENUE_SEATS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_EVENT_SEATS_TICKET_TYPE
    FOREIGN KEY (TICKET_TYPE_ID) REFERENCES TICKET_TYPES(ID) ON DELETE RESTRICT,
  UNIQUE KEY UQ_EVENT_SEATS_EVENT_VENUE_SEAT (EVENT_ID, VENUE_SEAT_ID),
  INDEX IDX_EVENT_SEATS_EVENT_STATUS (EVENT_ID, STATUS),      -- powers the seat-map load query
  INDEX IDX_EVENT_SEATS_HOLD (CURRENT_HOLD_ID),
  INDEX IDX_EVENT_SEATS_TICKET_TYPE (TICKET_TYPE_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- CURRENT_HOLD_ID / ORDER_ITEM_ID FKs are added via ALTER TABLE below,
-- after TICKET_HOLDS / TICKET_ORDER_ITEMS exist (same forward-reference
-- pattern PRODUCTS.MERCHANT_ID uses in 004_merchants.sql).

-- One row per customer basket attempt — groups every seat + GA line the
-- customer selected together so the whole selection expires as ONE
-- unit (EXPIRES_AT lives here, authoritatively; individual TICKET_HOLDS
-- rows below no longer carry their own expiry). IDEMPOTENCY_KEY +
-- USER_ID make a repeated hold request (double-click, retry, browser
-- reconnect) return the SAME session instead of creating a second
-- reservation — same pattern as CHECKOUT_IDEMPOTENCY
-- (005_orders_checkout.sql), scoped to hold-creation instead of
-- checkout.
CREATE TABLE TICKET_HOLD_SESSIONS (
  ID                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  EVENT_ID          INT UNSIGNED NOT NULL,
  USER_ID           INT UNSIGNED NOT NULL,
  IDEMPOTENCY_KEY   VARCHAR(100) NOT NULL,
  STATUS            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE | CONVERTED | RELEASED | EXPIRED — app-validated
  EXPIRES_AT        TIMESTAMP NOT NULL,                       -- server-computed (DB NOW() + INTERVAL), never client-supplied; the frontend countdown is display-only
  CREATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_TICKET_HOLD_SESSIONS_EVENT
    FOREIGN KEY (EVENT_ID) REFERENCES EVENTS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_TICKET_HOLD_SESSIONS_USER
    FOREIGN KEY (USER_ID) REFERENCES USERS(ID) ON DELETE CASCADE,
  UNIQUE KEY UQ_TICKET_HOLD_SESSIONS_USER_KEY (USER_ID, IDEMPOTENCY_KEY),
  INDEX IDX_TICKET_HOLD_SESSIONS_EVENT_STATUS_EXPIRES (EVENT_ID, STATUS, EXPIRES_AT), -- powers the expiry-sweep job
  INDEX IDX_TICKET_HOLD_SESSIONS_USER (USER_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per held resource (one reserved seat, or one GA line) within
-- a TICKET_HOLD_SESSIONS. Exactly one of EVENT_SEAT_ID / EVENT_SECTION_ID
-- is set per row (reserved seat vs GA quantity) — enforced in
-- application code, see the file header. STATUS is still tracked per
-- row (not just at the session level) so an individual resource can be
-- removed from a basket without releasing the whole session.
CREATE TABLE TICKET_HOLDS (
  ID                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  HOLD_SESSION_ID   INT UNSIGNED NOT NULL,
  EVENT_ID          INT UNSIGNED NOT NULL,                   -- denormalized from the session for query convenience (e.g. "seats currently held for event X" without a join)
  EVENT_SEAT_ID     INT UNSIGNED NULL,                        -- set for a reserved-seat hold
  EVENT_SECTION_ID  INT UNSIGNED NULL,                        -- set for a GA quantity hold
  QUANTITY          INT UNSIGNED NOT NULL DEFAULT 1,           -- always 1 for a reserved seat; N for GA
  UNIT_PRICE        DECIMAL(10,2) NOT NULL,                    -- server-computed price snapshot at hold time
  STATUS            VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',     -- ACTIVE | CONVERTED | RELEASED | EXPIRED — app-validated
  CREATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_TICKET_HOLDS_SESSION
    FOREIGN KEY (HOLD_SESSION_ID) REFERENCES TICKET_HOLD_SESSIONS(ID) ON DELETE CASCADE,
  CONSTRAINT FK_TICKET_HOLDS_EVENT
    FOREIGN KEY (EVENT_ID) REFERENCES EVENTS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_TICKET_HOLDS_EVENT_SEAT
    FOREIGN KEY (EVENT_SEAT_ID) REFERENCES EVENT_SEATS(ID) ON DELETE CASCADE,
  CONSTRAINT FK_TICKET_HOLDS_EVENT_SECTION
    FOREIGN KEY (EVENT_SECTION_ID) REFERENCES EVENT_SECTIONS(ID) ON DELETE CASCADE,
  INDEX IDX_TICKET_HOLDS_SESSION (HOLD_SESSION_ID),
  INDEX IDX_TICKET_HOLDS_EVENT (EVENT_ID),
  INDEX IDX_TICKET_HOLDS_EVENT_SEAT (EVENT_SEAT_ID),
  INDEX IDX_TICKET_HOLDS_EVENT_SECTION (EVENT_SECTION_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE TICKET_ORDERS (
  ID              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ORDER_NUMBER    VARCHAR(30) NOT NULL,                       -- app-generated after insert, e.g. 'TKT00001' — same convention as ORDERS.ORDER_NUMBER
  EVENT_ID        INT UNSIGNED NOT NULL,
  USER_ID         INT UNSIGNED NOT NULL,
  HOLD_SESSION_ID INT UNSIGNED NULL,                          -- traceability: which hold session this order was converted from
  SUBTOTAL        DECIMAL(10,2) NOT NULL,
  SERVICE_FEE     DECIMAL(10,2) NOT NULL DEFAULT 0,
  TOTAL           DECIMAL(10,2) NOT NULL,
  CURRENCY        CHAR(3) NOT NULL DEFAULT 'BND',
  STATUS          VARCHAR(20) NOT NULL DEFAULT 'PENDING_PAYMENT', -- PENDING_PAYMENT | PAID | CANCELLED | REFUNDED | EXPIRED — app-validated, same casing convention as ORDERS.STATUS
  PAID_AT         TIMESTAMP NULL,
  CREATED_AT      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_TICKET_ORDERS_EVENT
    FOREIGN KEY (EVENT_ID) REFERENCES EVENTS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_TICKET_ORDERS_USER
    FOREIGN KEY (USER_ID) REFERENCES USERS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_TICKET_ORDERS_HOLD_SESSION
    FOREIGN KEY (HOLD_SESSION_ID) REFERENCES TICKET_HOLD_SESSIONS(ID) ON DELETE SET NULL,
  UNIQUE KEY UQ_TICKET_ORDERS_ORDER_NUMBER (ORDER_NUMBER),
  INDEX IDX_TICKET_ORDERS_EVENT (EVENT_ID),
  INDEX IDX_TICKET_ORDERS_USER (USER_ID),
  INDEX IDX_TICKET_ORDERS_STATUS (STATUS)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Ticket purchases always belong to a registered user, same as ORDERS —
-- no guest ticket checkout in this first implementation.

CREATE TABLE TICKET_ORDER_ITEMS (
  ID                        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  TICKET_ORDER_ID            INT UNSIGNED NOT NULL,
  TICKET_TYPE_ID             INT UNSIGNED NOT NULL,
  EVENT_SEAT_ID               INT UNSIGNED NULL,               -- set for a reserved-seat line item
  EVENT_SECTION_ID            INT UNSIGNED NULL,               -- set for a GA line item
  QUANTITY                    INT UNSIGNED NOT NULL DEFAULT 1,  -- always 1 for a reserved seat; N for GA (see EVENT_TICKETS below — a GA line item with QUANTITY=3 still issues 3 individually-scannable EVENT_TICKETS)
  TICKET_TYPE_NAME_SNAPSHOT   VARCHAR(100) NOT NULL,            -- ticket type NAME/PRICE can change after purchase — mirrors ORDER_ITEMS.PRODUCT_NAME_SNAPSHOT
  SEAT_CODE_SNAPSHOT          VARCHAR(40) NULL,                 -- e.g. 'VIP-A-R01-S01'; NULL for GA items
  UNIT_PRICE                  DECIMAL(10,2) NOT NULL,
  LINE_TOTAL                  DECIMAL(10,2) NOT NULL,
  CREATED_AT                  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FK_TICKET_ORDER_ITEMS_ORDER
    FOREIGN KEY (TICKET_ORDER_ID) REFERENCES TICKET_ORDERS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_TICKET_ORDER_ITEMS_TICKET_TYPE
    FOREIGN KEY (TICKET_TYPE_ID) REFERENCES TICKET_TYPES(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_TICKET_ORDER_ITEMS_EVENT_SEAT
    FOREIGN KEY (EVENT_SEAT_ID) REFERENCES EVENT_SEATS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_TICKET_ORDER_ITEMS_EVENT_SECTION
    FOREIGN KEY (EVENT_SECTION_ID) REFERENCES EVENT_SECTIONS(ID) ON DELETE RESTRICT,
  INDEX IDX_TICKET_ORDER_ITEMS_ORDER (TICKET_ORDER_ID),
  INDEX IDX_TICKET_ORDER_ITEMS_EVENT_SEAT (EVENT_SEAT_ID),
  INDEX IDX_TICKET_ORDER_ITEMS_EVENT_SECTION (EVENT_SECTION_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mirrors PAYMENT_TRANSACTIONS (006_payments.sql) exactly, column for
-- column, against TICKET_ORDERS instead of ORDERS — PAYMENT_TRANSACTIONS
-- itself cannot be reused (its ORDER_ID is NOT NULL and FK-bound to
-- ORDERS specifically; loosening that would touch the existing,
-- working ecommerce payment subsystem for no reason beyond this
-- feature). PaymentService/MockCyberSourceProvider/CyberSourceProvider
-- (Backend/services/payment/) need ZERO changes — they never reference
-- PAYMENT_TRANSACTIONS or ORDERS themselves; only the route handler
-- that calls them and records the result differs.
CREATE TABLE TICKET_PAYMENT_TRANSACTIONS (
  ID                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  TICKET_ORDER_ID         INT UNSIGNED NOT NULL,
  PROVIDER                VARCHAR(30) NOT NULL,          -- 'mock_cybersource' | 'cybersource' — matches PaymentService PROVIDER ids
  PROVIDER_TRANSACTION_ID VARCHAR(100) NULL,
  AMOUNT                  DECIMAL(10,2) NOT NULL,
  CURRENCY                CHAR(3) NOT NULL DEFAULT 'BND',
  STATUS                  VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING | AUTHORIZED | PAID | FAILED | CANCELLED | REFUNDED | PARTIALLY_REFUNDED
  RAW_RESPONSE            LONGTEXT NULL,                  -- sanitized JSON only — never store raw PAN/CVV here or anywhere
  CREATED_AT              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UPDATED_AT              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_TICKET_PAYMENT_TRANSACTIONS_ORDER
    FOREIGN KEY (TICKET_ORDER_ID) REFERENCES TICKET_ORDERS(ID) ON DELETE RESTRICT,
  INDEX IDX_TICKET_PAYMENT_TRANSACTIONS_ORDER (TICKET_ORDER_ID),
  INDEX IDX_TICKET_PAYMENT_TRANSACTIONS_STATUS (STATUS),
  INDEX IDX_TICKET_PAYMENT_TRANSACTIONS_CREATED_AT (CREATED_AT)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Each attempt (including retries) is its own row, same as
-- PAYMENT_TRANSACTIONS — doubles as the payment-attempt log.

-- The actual admission presented at the entrance. TICKET_ORDER_ITEMS
-- says what was bought (e.g. one GA line item, QUANTITY=3); this table
-- is what gets scanned — a GA QUANTITY=3 line item issues THREE
-- EVENT_TICKETS rows (EVENT_SEAT_ID NULL on all three), so each
-- attendee can be checked in independently. A reserved-seat line item
-- (QUANTITY always 1) issues exactly one, with EVENT_SEAT_ID set.
-- TOKEN_HASH follows this schema's existing "hash, never store the raw
-- secret" convention (bcrypt for passwords, SHA-256 for
-- CHECKOUT_IDEMPOTENCY.REQUEST_HASH) — the real scan token is generated
-- at issuance, returned to the client once (e.g. embedded in a QR
-- code), and never persisted in plain form.
CREATE TABLE EVENT_TICKETS (
  ID                      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  EVENT_ID                INT UNSIGNED NOT NULL,
  TICKET_ORDER_ITEM_ID    INT UNSIGNED NOT NULL,
  USER_ID                 INT UNSIGNED NOT NULL,          -- the purchaser/attendee account; no per-attendee reassignment in this first implementation
  EVENT_SEAT_ID           INT UNSIGNED NULL,                -- set for a reserved seat; NULL for a GA admission
  TICKET_CODE             VARCHAR(40) NOT NULL,             -- human/QR-encodable identifier, e.g. 'TKT-<event>-<sequence>'
  TOKEN_HASH               CHAR(64) NOT NULL,                -- sha256 of the real scan token — see note above
  STATUS                   VARCHAR(20) NOT NULL DEFAULT 'ISSUED', -- ISSUED | USED | VOID | REFUNDED — app-validated
  ISSUED_AT                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECKED_IN_AT             TIMESTAMP NULL,
  CHECKED_IN_BY_USER_ID     INT UNSIGNED NULL,                -- staff/admin account that performed the scan
  UPDATED_AT                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT FK_EVENT_TICKETS_EVENT
    FOREIGN KEY (EVENT_ID) REFERENCES EVENTS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_EVENT_TICKETS_ORDER_ITEM
    FOREIGN KEY (TICKET_ORDER_ITEM_ID) REFERENCES TICKET_ORDER_ITEMS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_EVENT_TICKETS_USER
    FOREIGN KEY (USER_ID) REFERENCES USERS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_EVENT_TICKETS_EVENT_SEAT
    FOREIGN KEY (EVENT_SEAT_ID) REFERENCES EVENT_SEATS(ID) ON DELETE RESTRICT,
  CONSTRAINT FK_EVENT_TICKETS_CHECKED_IN_BY
    FOREIGN KEY (CHECKED_IN_BY_USER_ID) REFERENCES USERS(ID) ON DELETE SET NULL,
  UNIQUE KEY UQ_EVENT_TICKETS_CODE (TICKET_CODE),
  UNIQUE KEY UQ_EVENT_TICKETS_TOKEN_HASH (TOKEN_HASH),
  UNIQUE KEY UQ_EVENT_TICKETS_EVENT_SEAT (EVENT_SEAT_ID),  -- NULL-safe (MySQL doesn't enforce uniqueness among NULLs — same trick as CARTS.USER_ID in 005_orders_checkout.sql), so this only ever blocks two tickets for the SAME reserved seat, never multiple GA tickets
  INDEX IDX_EVENT_TICKETS_ORDER_ITEM (TICKET_ORDER_ITEM_ID),
  INDEX IDX_EVENT_TICKETS_EVENT_STATUS (EVENT_ID, STATUS),
  INDEX IDX_EVENT_TICKETS_USER (USER_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Forward-reference FKs — added now that TICKET_HOLDS / TICKET_ORDER_ITEMS
-- exist, same pattern as PRODUCTS.MERCHANT_ID in 004_merchants.sql.
ALTER TABLE EVENT_SEATS
  ADD CONSTRAINT FK_EVENT_SEATS_HOLD
    FOREIGN KEY (CURRENT_HOLD_ID) REFERENCES TICKET_HOLDS(ID) ON DELETE SET NULL,
  ADD CONSTRAINT FK_EVENT_SEATS_ORDER_ITEM
    FOREIGN KEY (ORDER_ITEM_ID) REFERENCES TICKET_ORDER_ITEMS(ID) ON DELETE SET NULL;
