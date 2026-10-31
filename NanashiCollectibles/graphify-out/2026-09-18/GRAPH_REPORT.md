# Graph Report - nanashicollectibles  (2026-09-18)

## Corpus Check
- 229 files · ~677,038 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 962 nodes · 2939 edges · 59 communities (41 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `204ca5af`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ShopPage.jsx
- useAuth
- MerchantProductNewPage.jsx
- App.jsx
- CheckoutPage.jsx
- formatMoney
- BlackHoleHeroSection
- useSocket
- useApiResource
- main.jsx
- Nanashi Collectibles Legacy README
- package.json
- merchantApi.js
- merchantProductSocketService.js
- SectionHeading.jsx
- devDependencies
- adminApi.js
- /graphify Command
- dependencies
- AdminMerchantDetailPage.jsx
- Step 6 - Obsidian Vault + HTML Export
- Step 0 - GitHub Repos and Multi-Path Merge
- TicketingDemo.jsx
- ProductDetailPage.jsx
- ProductImageEditor.jsx
- Part B - Semantic Extraction (Parallel Subagents)
- Extraction Subagent Prompt Template
- Step 4 - Build Graph, Cluster, Analyze
- eslint.config.js
- scripts
- Nanashi Homepage Design Reference (screenshot)
- BFS/DFS Graph Traversal
- vite
- merchantStatusTransitions.js
- BankAccountForm
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
- MerchantLayout.jsx
- TcgPage.jsx
- AdminMerchantsPage
- OrderConfirmationPage
- react
- useMerchantAuth
- joinTournament
- emitWithAck
- MerchantOrderDetailPage.jsx
- BankAccountsSection

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

## Communities (59 total, 18 thin omitted)

### Community 0 - "ShopPage.jsx"
Cohesion: 0.13
Nodes (10): ProductGridSkeleton(), ProductSearch(), ProductSort(), SORT_OPTIONS, ProductTypeFilter(), ShopHeader(), Skeleton(), listProductTypes() (+2 more)

### Community 1 - "useAuth"
Cohesion: 0.06
Nodes (38): AdminLayout(), Container(), SIZES, Footer(), Layout(), AccountMenu(), CartLink(), AuthControls() (+30 more)

### Community 2 - "MerchantProductNewPage.jsx"
Cohesion: 0.24
Nodes (6): ProductForm(), toEditorImages(), toFormState(), createProduct(), MerchantProductNewPage(), handleSubmit()

### Community 3 - "App.jsx"
Cohesion: 0.09
Nodes (18): ForgotPasswordPage(), ResetPasswordPage(), EsportsPage(), MerchantLoginPage(), MerchantPendingPage(), MerchantPortalPage(), primaryAction(), MerchantRegisterPage() (+10 more)

### Community 4 - "CheckoutPage.jsx"
Cohesion: 0.10
Nodes (31): AddressSelectorModal(), DeliveryDetailsSection(), ALLOWED_TYPES, DeliveryReferencePhotoUpload(), handleFile(), AddressError, createAddress(), getAddresses() (+23 more)

### Community 5 - "formatMoney"
Cohesion: 0.18
Nodes (13): AgingTile(), CommissionReceivableSection(), defaultPeriod(), IssueStatementModal(), handleSubmit(), RecordPaymentModal(), handleSubmit(), formatDate() (+5 more)

### Community 6 - "BlackHoleHeroSection"
Cohesion: 0.21
Nodes (14): BlackHoleHeroSection(), bind(), build(), compile(), draw(), dropTargets(), link(), makeTarget() (+6 more)

### Community 7 - "useSocket"
Cohesion: 0.31
Nodes (11): RelatedProducts(), getProductBySlug(), listShopCategories(), listShopProducts(), useProduct(), useShopCategories(), useFeaturedProducts(), useShopProducts() (+3 more)

### Community 8 - "useApiResource"
Cohesion: 0.21
Nodes (14): DataTable(), Pagination(), StatusBadge(), toLabel(), TONE_BY_STATUS, useApiResource(), ACTIONS, AdminAuditLogPage() (+6 more)

### Community 9 - "main.jsx"
Cohesion: 0.10
Nodes (25): socket.io-client, App(), ToastContext, ICON, ToastProvider(), TONES, AuthContext, AuthProvider() (+17 more)

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
Cohesion: 0.21
Nodes (11): InventoryAdjustModal(), handleSubmit(), adjustInventory(), getProductById(), listProductCategories(), listProducts(), updateProduct(), useMerchantProduct() (+3 more)

### Community 14 - "SectionHeading.jsx"
Cohesion: 0.07
Nodes (44): framer-motion, KpiCard(), RevenueTrendChart(), MarketplaceEmptyState(), BlurFade(), EmptyState(), SectionHeading(), TITLE_SIZES (+36 more)

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

### Community 19 - "AdminMerchantDetailPage.jsx"
Cohesion: 0.14
Nodes (9): DateRangeTabs(), RANGES, KpiCard(), AdminMerchantDetailPage(), parseSocialLinks(), PAYMENT_METHOD_LABELS, REASON_OPTIONS, REVIEW_COPY (+1 more)

### Community 20 - "Step 6 - Obsidian Vault + HTML Export"
Cohesion: 0.22
Nodes (9): Token Reduction Benchmark, FalkorDB Export / Push, Graphify MCP Stdio Server, Neo4j Export / Push, SVG / GraphML Export, Wiki Export (--wiki), Manifest Stamp-On-Output-Only Rule (#2015), Step 6 - Obsidian Vault + HTML Export (+1 more)

### Community 21 - "Step 0 - GitHub Repos and Multi-Path Merge"
Cohesion: 0.25
Nodes (9): graphify clone <github-url>, graphify merge-graphs, Monorepo Subfolder Extraction Flow, graphify.transcribe.transcribe_all, Whisper Domain-Hint Prompt, Step 0 - GitHub Repos and Multi-Path Merge, Step 1 - Ensure Graphify Is Installed, Step 2.5 - Video and Audio Transcription (+1 more)

### Community 22 - "TicketingDemo.jsx"
Cohesion: 0.08
Nodes (32): DemoCheckoutSummary(), DemoHoldCountdown(), formatClock(), CATEGORY_CODE, DEMO_ACCESSIBLE_SEATS, DEMO_GA_AVAILABLE, DEMO_UNAVAILABLE_SEATS, seatCode() (+24 more)

### Community 23 - "ProductDetailPage.jsx"
Cohesion: 0.07
Nodes (30): CartItemRow(), OrderSummary(), ProductsSlot(), FulfilmentMethodCards(), TYPE_LABELS, FeaturedRail(), isRecentlyListed(), ProductCard() (+22 more)

### Community 24 - "ProductImageEditor.jsx"
Cohesion: 0.31
Nodes (5): ALLOWED_TYPES, fileToBase64(), ProductImageEditor(), handleFiles(), uploadProductImage()

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

### Community 50 - "MerchantLayout.jsx"
Cohesion: 0.14
Nodes (10): ADMIN_NAV, MerchantLayout(), MerchantMobileDrawer(), ALL_ROLES, MERCHANT_NAV, navForRole(), MerchantNavIcon(), PATHS (+2 more)

### Community 52 - "TcgPage.jsx"
Cohesion: 0.19
Nodes (11): excerpt(), NewsListItem(), TradeListingCard(), listDecklists(), listTcgGames(), listTrades(), useDecklists(), useTcgGames() (+3 more)

### Community 53 - "AdminMerchantsPage"
Cohesion: 1.00
Nodes (3): AdminMerchantsPage(), handleSearchSubmit(), updateParams()

### Community 54 - "OrderConfirmationPage"
Cohesion: 0.24
Nodes (10): getOrder(), listOrders(), OrderError, request(), groupByMerchantOrder(), offlinePaymentStatusCopy(), OrderConfirmationPage(), load() (+2 more)

### Community 55 - "react"
Cohesion: 0.06
Nodes (61): react, react-router-dom, AdminMobileDrawer(), AdminNavLinks(), AdminSidebar(), PAYMENT_METHOD_LABELS, STATEMENT_STATUS_TONE, EMPTY_FORM (+53 more)

### Community 56 - "useMerchantAuth"
Cohesion: 0.15
Nodes (15): RoleGate(), useToast(), useMerchantAuth(), MerchantInventoryPage(), FulfilmentMethodsSection(), toggle(), OnlinePaymentSection(), PaymentMethodsSection() (+7 more)

### Community 58 - "joinTournament"
Cohesion: 0.47
Nodes (5): IndividualJoinForm(), handleJoin(), TeamJoinForm(), handleJoin(), joinTournament()

### Community 60 - "emitWithAck"
Cohesion: 0.16
Nodes (14): listNews(), useNews(), createEnquiry(), listServices(), TournamentRegistrationForm(), handleLeave(), leaveTournament(), listTournaments() (+6 more)

### Community 61 - "MerchantOrderDetailPage.jsx"
Cohesion: 0.23
Nodes (8): formatDateTime(), archiveProduct(), CONFIRM_BUTTON_LABELS, CONFIRMABLE_PAYMENT_STATUSES, MerchantOrderDetailPage(), PAYMENT_METHOD_LABELS, MerchantProductDetailPage(), handleArchive()

## Ambiguous Edges - Review These
- `NanashiCollectibles App Shell (index.html)` → `Nanashi Collectibles Legacy README`  [AMBIGUOUS]
  index.html · relation: conceptually_related_to
- `NanashiCollectibles Multi-Vertical Platform` → `Nanashi Collectibles Legacy README`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **153 isolated node(s):** `21st`, `name`, `private`, `version`, `type` (+148 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 268 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `NanashiCollectibles App Shell (index.html)` and `Nanashi Collectibles Legacy README`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `NanashiCollectibles Multi-Vertical Platform` and `Nanashi Collectibles Legacy README`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `react` to `ShopPage.jsx`, `useAuth`, `MerchantProductNewPage.jsx`, `CheckoutPage.jsx`, `BlackHoleHeroSection`, `useSocket`, `useApiResource`, `main.jsx`, `package.json`, `merchantProductSocketService.js`, `SectionHeading.jsx`, `AdminMerchantDetailPage.jsx`, `TicketingDemo.jsx`, `ProductDetailPage.jsx`, `ProductImageEditor.jsx`, `MerchantLayout.jsx`, `TcgPage.jsx`, `useMerchantAuth`, `MerchantOrderDetailPage.jsx`?**
  _High betweenness centrality (0.225) - this node is a cross-community bridge._
- **Why does `react-router-dom` connect `react` to `ShopPage.jsx`, `useAuth`, `MerchantProductNewPage.jsx`, `App.jsx`, `CheckoutPage.jsx`, `useApiResource`, `main.jsx`, `package.json`, `SectionHeading.jsx`, `MerchantLayout.jsx`, `AdminMerchantDetailPage.jsx`, `TcgPage.jsx`, `ProductDetailPage.jsx`, `MerchantOrderDetailPage.jsx`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `Button()` connect `react` to `ShopPage.jsx`, `useAuth`, `CheckoutPage.jsx`, `useSocket`, `useApiResource`, `SectionHeading.jsx`, `AdminMerchantDetailPage.jsx`, `TcgPage.jsx`, `TicketingDemo.jsx`, `ProductDetailPage.jsx`, `useMerchantAuth`, `MerchantOrderDetailPage.jsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `21st`, `name`, `private` to the rest of the system?**
  _153 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ShopPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._