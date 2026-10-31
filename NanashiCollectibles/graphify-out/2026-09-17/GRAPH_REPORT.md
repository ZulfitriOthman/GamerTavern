# Graph Report - nanashicollectibles  (2026-09-17)

## Corpus Check
- 229 files · ~676,527 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 960 nodes · 2932 edges · 69 communities (49 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `204ca5af`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ShopPage.jsx
- orderService.js
- formatMoney
- App.jsx
- CheckoutPage.jsx
- DeliveryReferencePhotoUpload.jsx
- useSocket
- addressService.js
- Header.jsx
- Nanashi Collectibles Legacy README
- package.json
- merchantApi.js
- merchantProductSocketService.js
- TournamentRegistrationForm.jsx
- devDependencies
- adminApi.js
- /graphify Command
- dependencies
- MerchantProductNewPage.jsx
- Step 6 - Obsidian Vault + HTML Export
- Step 0 - GitHub Repos and Multi-Path Merge
- TicketingDemo.jsx
- ProductImageEditor.jsx
- react
- Part B - Semantic Extraction (Parallel Subagents)
- Extraction Subagent Prompt Template
- Step 4 - Build Graph, Cluster, Analyze
- eslint.config.js
- scripts
- Nanashi Homepage Design Reference (screenshot)
- BFS/DFS Graph Traversal
- vite
- merchantStatusTransitions.js
- AddressSelectorModal
- .mcp.json
- overrides
- Auth Background Image (Fluid Orange/Black Marble)
- Cart Background (Aurora Borealis)
- Chat Background (Nebula)
- News Background Image
- Profile Background (Nebula Space Image)
- Shop Background (Milky Way Night Sky)
- Trade Background (Milky Way Night Sky)
- react.svg (React Logo Icon)
- Vite Logo (favicon)
- MerchantOrderDetailPage.jsx
- AdminLayout.jsx
- react-router-dom
- emitWithAck
- useTcgGames
- AdminMerchantDetailPage.jsx
- useApiResource
- Button.jsx
- Card.jsx
- main.jsx
- useAuth
- OrderConfirmationPage.jsx
- CartProvider.jsx
- authService.js
- LoginPage.jsx
- createEnquiry
- WishlistProvider.jsx
- ReviewsSection.jsx
- NavDropdown
- BankAccountsSection
- BankAccountForm

## God Nodes (most connected - your core abstractions)
1. `react` - 86 edges
2. `Button()` - 63 edges
3. `react-router-dom` - 61 edges
4. `useApiResource()` - 44 edges
5. `useSocket()` - 44 edges
6. `Card` - 38 edges
7. `useAuth()` - 38 edges
8. `useMerchantAuth()` - 38 edges
9. `Section()` - 33 edges
10. `SectionHeading()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `NanashiCollectibles App Shell (index.html)` --semantically_similar_to--> `NanashiCollectibles Multi-Vertical Platform`  [INFERRED] [semantically similar]
  index.html → CLAUDE.md
- `NanashiCollectibles App Shell (index.html)` --conceptually_related_to--> `Nanashi Collectibles Legacy README`  [AMBIGUOUS]
  index.html → README.md
- `Nanashi Collectibles Legacy README` --shares_data_with--> `Render Web Service Config`  [INFERRED]
  README.md → render.yaml
- `Nanashi Collectibles Legacy README` --conceptually_related_to--> `NanashiCollectibles Multi-Vertical Platform`  [AMBIGUOUS]
  README.md → CLAUDE.md
- `graphify hook install (Post-Commit Auto-Rebuild)` --conceptually_related_to--> `--update Incremental Re-Extraction`  [INFERRED]
  .claude/skills/graphify/references/hooks.md → .claude/skills/graphify/references/update.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Full Pipeline Sequence (Steps 0-9)** — claude_skills_graphify_skill_step2_detect_files, claude_skills_graphify_skill_step3_extract, claude_skills_graphify_skill_step4_build_graph, claude_skills_graphify_skill_step5_label_communities, claude_skills_graphify_skill_step6_viz_export, claude_skills_graphify_skill_step9_manifest_cleanup [EXTRACTED 1.00]
- **Incremental Update Merge & Manifest Flow** — claude_skills_graphify_references_update_incremental, claude_skills_graphify_references_update_build_merge, claude_skills_graphify_references_update_manifest_stamping [EXTRACTED 1.00]
- **Self-Improving Query Feedback Loop** — claude_skills_graphify_references_query_bfs_dfs_traversal, claude_skills_graphify_references_query_save_result, claude_skills_graphify_references_query_work_memory [EXTRACTED 1.00]

## Communities (69 total, 20 thin omitted)

### Community 0 - "ShopPage.jsx"
Cohesion: 0.18
Nodes (7): MarketplaceEmptyState(), ProductGridSkeleton(), ProductSearch(), ProductSort(), SORT_OPTIONS, ProductTypeFilter(), ShopHeader()

### Community 1 - "orderService.js"
Cohesion: 0.43
Nodes (5): listOrders(), OrderError, request(), OrdersListPage(), load()

### Community 2 - "formatMoney"
Cohesion: 0.14
Nodes (14): CartItemRow(), OrderSummary(), ProductsSlot(), FulfilmentMethodCards(), TYPE_LABELS, FeaturedRail(), isRecentlyListed(), ProductCard() (+6 more)

### Community 3 - "App.jsx"
Cohesion: 0.05
Nodes (28): ForgotPasswordPage(), ResetPasswordPage(), groupItemsByMerchant(), demoVenue, reservedCapacity, totalCapacity, InteractiveSeatingSection(), SeatMap() (+20 more)

### Community 4 - "CheckoutPage.jsx"
Cohesion: 0.20
Nodes (19): DeliveryDetailsSection(), CheckoutError, getFulfilmentMethods(), getPaymentEligibility(), getShippingMethods(), request(), submitBankTransferCheckout(), submitCheckout() (+11 more)

### Community 6 - "DeliveryReferencePhotoUpload.jsx"
Cohesion: 0.39
Nodes (5): ALLOWED_TYPES, DeliveryReferencePhotoUpload(), handleFile(), uploadDeliveryReferencePhoto(), resolveUploadUrl()

### Community 7 - "useSocket"
Cohesion: 0.22
Nodes (14): RelatedProducts(), getProductBySlug(), listProductTypes(), listShopCategories(), listShopProducts(), useProduct(), useProductTypes(), useShopCategories() (+6 more)

### Community 8 - "addressService.js"
Cohesion: 0.36
Nodes (6): AddressError, createAddress(), getAddresses(), request(), handleCreateAddress(), loadAddresses()

### Community 9 - "Header.jsx"
Cohesion: 0.14
Nodes (13): Container(), SIZES, Footer(), Layout(), CartLink(), Header(), MobileNav(), businessPillars (+5 more)

### Community 10 - "Nanashi Collectibles Legacy README"
Cohesion: 0.11
Nodes (20): Canonical REST JWT Authentication, Checkout Idempotency Key, Database Ownership Policy, UI/UX Design Constitution, Known Technical Debt Summary, Marketplace Layer (Section 62), NanashiCollectibles Multi-Vertical Platform, orderStateMachine Module (+12 more)

### Community 11 - "package.json"
Cohesion: 0.11
Nodes (18): name, private, type, version, autoprefixer, babel-plugin-react-compiler, cors, eslint (+10 more)

### Community 12 - "merchantApi.js"
Cohesion: 0.12
Nodes (30): addStaff(), authHeaders(), confirmOrderPayment(), deleteBankDetails(), getDashboard(), getFulfilmentMethods(), getMe(), getNotificationSettings() (+22 more)

### Community 13 - "merchantProductSocketService.js"
Cohesion: 0.24
Nodes (11): archiveProduct(), getProductById(), listProductCategories(), listProducts(), updateProduct(), useMerchantProduct(), useProductCategories(), MerchantProductDetailPage() (+3 more)

### Community 14 - "TournamentRegistrationForm.jsx"
Cohesion: 0.33
Nodes (8): IndividualJoinForm(), handleJoin(), TeamJoinForm(), handleJoin(), TournamentRegistrationForm(), handleLeave(), joinTournament(), leaveTournament()

### Community 15 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, babel-plugin-react-compiler, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+7 more)

### Community 16 - "adminApi.js"
Cohesion: 0.23
Nodes (14): AdminApiError, authHeaders(), getAuditLog(), getDashboardStats(), getMerchant(), getMerchantAnalytics(), getMerchantFinance(), getMerchants() (+6 more)

### Community 17 - "/graphify Command"
Cohesion: 0.22
Nodes (11): Graphify Skill Pointer, /graphify add <url>, --watch Folder Auto-Rebuild, graphify claude install (Native CLAUDE.md Integration), graphify hook install (Post-Commit Auto-Rebuild), /graphify explain, /graphify path, --cluster-only (+3 more)

### Community 18 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, cors, express, framer-motion, lightweight-charts, mysql2, react, react-dom (+3 more)

### Community 19 - "MerchantProductNewPage.jsx"
Cohesion: 0.24
Nodes (6): ProductForm(), toEditorImages(), toFormState(), createProduct(), MerchantProductNewPage(), handleSubmit()

### Community 20 - "Step 6 - Obsidian Vault + HTML Export"
Cohesion: 0.22
Nodes (9): Token Reduction Benchmark, FalkorDB Export / Push, Graphify MCP Stdio Server, Neo4j Export / Push, SVG / GraphML Export, Wiki Export (--wiki), Manifest Stamp-On-Output-Only Rule (#2015), Step 6 - Obsidian Vault + HTML Export (+1 more)

### Community 21 - "Step 0 - GitHub Repos and Multi-Path Merge"
Cohesion: 0.25
Nodes (9): graphify clone <github-url>, graphify merge-graphs, Monorepo Subfolder Extraction Flow, graphify.transcribe.transcribe_all, Whisper Domain-Hint Prompt, Step 0 - GitHub Repos and Multi-Path Merge, Step 1 - Ensure Graphify Is Installed, Step 2.5 - Video and Audio Transcription (+1 more)

### Community 22 - "TicketingDemo.jsx"
Cohesion: 0.08
Nodes (31): DemoCheckoutSummary(), DemoHoldCountdown(), formatClock(), CATEGORY_CODE, DEMO_ACCESSIBLE_SEATS, DEMO_GA_AVAILABLE, DEMO_UNAVAILABLE_SEATS, seatCode() (+23 more)

### Community 23 - "ProductImageEditor.jsx"
Cohesion: 0.31
Nodes (5): ALLOWED_TYPES, fileToBase64(), ProductImageEditor(), handleFiles(), uploadProductImage()

### Community 24 - "react"
Cohesion: 0.06
Nodes (37): react, EMPTY_FORM, InventoryAdjustModal(), handleSubmit(), REASONS_BY_TYPE, TYPE_OPTIONS, OrderStatusPanel(), STATUS_OPTIONS (+29 more)

### Community 25 - "Part B - Semantic Extraction (Parallel Subagents)"
Cohesion: 0.38
Nodes (7): Semantic Extraction Cache (Step B0), Gemini Backend Semantic Extraction, Part A - Structural (AST) Extraction, Part B - Semantic Extraction (Parallel Subagents), Part C - Merge AST + Semantic, Step 3 - Extract Entities and Relationships, Parallel Subagent Dispatch (Step B2)

### Community 26 - "Extraction Subagent Prompt Template"
Cohesion: 0.33
Nodes (6): Confidence Score Rubric, Hyperedge Extraction Rule, Node ID Format Rule, Semantic Similarity Edge Rule, Extraction Subagent Prompt Template, Graphify Honesty Rules

### Community 27 - "Step 4 - Build Graph, Cluster, Analyze"
Cohesion: 0.40
Nodes (5): graphify.build.build_merge, graph.json Shrink Guard (#479), Step 4.5 - Graph Health Check, Step 4 - Build Graph, Cluster, Analyze, Step 5 - Label Communities

### Community 28 - "eslint.config.js"
Cohesion: 0.40
Nodes (4): @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals

### Community 29 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, lint, preview

### Community 30 - "Nanashi Homepage Design Reference (screenshot)"
Cohesion: 0.60
Nodes (5): Hero Section: 'NANASHI - Giving Form to Possibilities', Nanashi Homepage Design Reference (screenshot), Homepage Nav Header (Shop/Services/TCG/RVS Esports/About), RVS Esports 'Live Tournament Registration' section preview, 'One Name, Many Possibilities' vertical band (Digital/Commerce/Media/Aero/Technology)

### Community 31 - "BFS/DFS Graph Traversal"
Cohesion: 0.50
Nodes (4): BFS/DFS Graph Traversal, save-result Feedback Loop, Constrained Query Vocabulary Expansion, Work Memory / reflect / LESSONS.md

### Community 49 - "MerchantOrderDetailPage.jsx"
Cohesion: 0.12
Nodes (22): EmptyState(), ErrorState(), SkeletonCard(), SkeletonText(), formatDate(), formatDateTime(), formatEntryFee(), TournamentCard() (+14 more)

### Community 50 - "AdminLayout.jsx"
Cohesion: 0.10
Nodes (17): AdminLayout(), AdminMobileDrawer(), ADMIN_NAV, AdminNavLinks(), AdminSidebar(), MerchantLayout(), MerchantMobileDrawer(), ALL_ROLES (+9 more)

### Community 51 - "react-router-dom"
Cohesion: 0.07
Nodes (40): framer-motion, react-router-dom, Section(), SPACING, TONES, QuantityStepper(), SIZE, WishlistButton() (+32 more)

### Community 52 - "emitWithAck"
Cohesion: 0.24
Nodes (9): listNews(), useNews(), listServices(), listDecklists(), listTrades(), useDecklists(), useTrades(), TcgPage() (+1 more)

### Community 53 - "useTcgGames"
Cohesion: 0.60
Nodes (3): listTcgGames(), useTcgGames(), TcgSection()

### Community 55 - "AdminMerchantDetailPage.jsx"
Cohesion: 0.08
Nodes (27): AgingTile(), CommissionReceivableSection(), defaultPeriod(), IssueStatementModal(), handleSubmit(), PAYMENT_METHOD_LABELS, RecordPaymentModal(), handleSubmit() (+19 more)

### Community 56 - "useApiResource"
Cohesion: 0.12
Nodes (23): RoleGate(), formatDate(), useMerchantAuth(), useApiResource(), AdminDashboardPage(), MerchantDashboardPage(), MerchantInventoryPage(), MerchantOrdersListPage() (+15 more)

### Community 57 - "Button.jsx"
Cohesion: 0.22
Nodes (14): Button(), SIZES, VARIANTS, DataTable(), Pagination(), SectionHeading(), TITLE_SIZES, StatusBadge() (+6 more)

### Community 58 - "Card.jsx"
Cohesion: 0.17
Nodes (13): KpiCard(), Badge(), TONES, Card, PADDING, VARIANTS, MerchantPendingPage(), MESSAGES (+5 more)

### Community 59 - "main.jsx"
Cohesion: 0.23
Nodes (9): App(), ToastContext, ICON, ToastProvider(), TONES, AuthContext, AuthProvider(), readStoredToken() (+1 more)

### Community 60 - "useAuth"
Cohesion: 0.16
Nodes (10): socket.io-client, AccountMenu(), AuthControls(), useAuth(), MerchantAuthContext, MerchantAuthProvider(), normalizeMembership(), MerchantRoot() (+2 more)

### Community 61 - "OrderConfirmationPage.jsx"
Cohesion: 0.23
Nodes (11): ContactAddressCard(), COUNTRY_NAMES, formatAddressInline(), formatAddressLines(), getOrder(), groupByMerchantOrder(), OFFLINE_PAYMENT_METHOD_LABELS, offlinePaymentStatusCopy() (+3 more)

### Community 62 - "CartProvider.jsx"
Cohesion: 0.47
Nodes (10): CartProvider(), readGuestToken(), writeGuestToken(), addCartItem(), clearCart(), getCart(), mergeGuestCart(), removeCartItem() (+2 more)

### Community 63 - "authService.js"
Cohesion: 0.39
Nodes (7): AuthError, forgotPassword(), login(), me(), register(), request(), resetPassword()

### Community 64 - "LoginPage.jsx"
Cohesion: 0.36
Nodes (6): site, LoginPage(), handleSubmit(), RegisterPage(), handleSubmit(), safeRedirect()

### Community 65 - "createEnquiry"
Cohesion: 0.28
Nodes (6): createEnquiry(), ContactPage(), handleSubmit(), categoryForKey(), QuotationForm(), handleSubmit()

### Community 66 - "WishlistProvider.jsx"
Cohesion: 0.71
Nodes (5): WishlistProvider(), addToWishlist(), getWishlist(), removeFromWishlist(), request()

### Community 67 - "ReviewsSection.jsx"
Cohesion: 0.48
Nodes (3): ReviewsSection(), listProductReviews(), useProductReviews()

## Ambiguous Edges - Review These
- `NanashiCollectibles App Shell (index.html)` → `Nanashi Collectibles Legacy README`  [AMBIGUOUS]
  index.html · relation: conceptually_related_to
- `NanashiCollectibles Multi-Vertical Platform` → `Nanashi Collectibles Legacy README`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **152 isolated node(s):** `21st`, `name`, `private`, `version`, `type` (+147 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 267 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `NanashiCollectibles App Shell (index.html)` and `Nanashi Collectibles Legacy README`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `NanashiCollectibles Multi-Vertical Platform` and `Nanashi Collectibles Legacy README`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `react` to `ShopPage.jsx`, `formatMoney`, `App.jsx`, `CheckoutPage.jsx`, `DeliveryReferencePhotoUpload.jsx`, `useSocket`, `Header.jsx`, `package.json`, `merchantProductSocketService.js`, `TournamentRegistrationForm.jsx`, `MerchantProductNewPage.jsx`, `TicketingDemo.jsx`, `ProductImageEditor.jsx`, `MerchantOrderDetailPage.jsx`, `AdminLayout.jsx`, `react-router-dom`, `useTcgGames`, `AdminMerchantDetailPage.jsx`, `useApiResource`, `Button.jsx`, `Card.jsx`, `main.jsx`, `useAuth`, `OrderConfirmationPage.jsx`, `CartProvider.jsx`, `LoginPage.jsx`, `WishlistProvider.jsx`, `NavDropdown`?**
  _High betweenness centrality (0.226) - this node is a cross-community bridge._
- **Why does `react-router-dom` connect `react-router-dom` to `LoginPage.jsx`, `ShopPage.jsx`, `formatMoney`, `App.jsx`, `NavDropdown`, `CheckoutPage.jsx`, `Header.jsx`, `package.json`, `MerchantOrderDetailPage.jsx`, `AdminLayout.jsx`, `MerchantProductNewPage.jsx`, `AdminMerchantDetailPage.jsx`, `react`, `Button.jsx`, `Card.jsx`, `main.jsx`, `useAuth`, `OrderConfirmationPage.jsx`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `Button()` connect `Button.jsx` to `LoginPage.jsx`, `ShopPage.jsx`, `App.jsx`, `CheckoutPage.jsx`, `useApiResource`, `useSocket`, `Header.jsx`, `TournamentRegistrationForm.jsx`, `MerchantOrderDetailPage.jsx`, `AdminLayout.jsx`, `react-router-dom`, `TicketingDemo.jsx`, `AdminMerchantDetailPage.jsx`, `react`, `Card.jsx`, `OrderConfirmationPage.jsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `21st`, `name`, `private` to the rest of the system?**
  _152 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `formatMoney` be split into smaller, more focused modules?**
  _Cohesion score 0.14333333333333334 - nodes in this community are weakly interconnected._