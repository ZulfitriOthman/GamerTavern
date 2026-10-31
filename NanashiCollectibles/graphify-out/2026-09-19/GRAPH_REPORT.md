# Graph Report - nanashicollectibles  (2026-09-19)

## Corpus Check
- 229 files · ~678,275 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 965 nodes · 2944 edges · 63 communities (44 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `204ca5af`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ShopPage.jsx
- Header.jsx
- ProductForm.jsx
- App.jsx
- CheckoutPage.jsx
- ProductCard.jsx
- BlackHoleHeroSection
- useSocket
- useApiResource
- main.jsx
- Nanashi Collectibles Legacy README
- package.json
- merchantApi.js
- merchantProductSocketService.js
- MerchantOrderDetailPage.jsx
- devDependencies
- adminApi.js
- /graphify Command
- dependencies
- AdminMerchantDetailPage.jsx
- Step 6 - Obsidian Vault + HTML Export
- Step 0 - GitHub Repos and Multi-Path Merge
- TicketingDemo.jsx
- InventoryAdjustModal
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
- react-router-dom
- AdminLayout.jsx
- emitWithAck
- useAuth
- react
- MerchantSettingsBankPage.jsx
- EsportsPage.jsx
- CartProvider.jsx
- createEnquiry
- Skeleton.jsx
- authService.js
- BankAccountsSection
- WishlistProvider.jsx
- Footer.jsx
- CartPage

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

## Communities (63 total, 19 thin omitted)

### Community 0 - "ShopPage.jsx"
Cohesion: 0.12
Nodes (11): FeaturedRail(), MarketplaceEmptyState(), ProductFilters(), ProductGrid(), ProductGridSkeleton(), ProductSearch(), ProductSort(), SORT_OPTIONS (+3 more)

### Community 1 - "Header.jsx"
Cohesion: 0.15
Nodes (9): Container(), SIZES, CartLink(), MobileNav(), NavDropdown(), primaryNav, utilityNav, CartContext (+1 more)

### Community 2 - "ProductForm.jsx"
Cohesion: 0.18
Nodes (9): ProductForm(), STATUS_OPTIONS, toEditorImages(), toFormState(), FieldHelp(), listProductCategories(), useProductCategories(), listProductTypes() (+1 more)

### Community 3 - "App.jsx"
Cohesion: 0.06
Nodes (31): ForgotPasswordPage(), LoginPage(), handleSubmit(), RegisterPage(), handleSubmit(), ResetPasswordPage(), safeRedirect(), demoVenue (+23 more)

### Community 4 - "CheckoutPage.jsx"
Cohesion: 0.06
Nodes (47): AddressSelectorModal(), ContactAddressCard(), DeliveryDetailsSection(), ALLOWED_TYPES, DeliveryReferencePhotoUpload(), handleFile(), FulfilmentMethodCards(), TYPE_LABELS (+39 more)

### Community 5 - "ProductCard.jsx"
Cohesion: 0.15
Nodes (12): ALLOWED_TYPES, fileToBase64(), ProductImageEditor(), handleFiles(), isRecentlyListed(), ProductCard(), ProductGallery(), uploadProductImage() (+4 more)

### Community 6 - "BlackHoleHeroSection"
Cohesion: 0.18
Nodes (17): BlackHoleHeroSection(), bind(), build(), compile(), draw(), dropTargets(), link(), makeTarget() (+9 more)

### Community 7 - "useSocket"
Cohesion: 0.25
Nodes (12): RelatedProducts(), getProductBySlug(), listShopCategories(), listShopProducts(), useProduct(), useShopCategories(), useFeaturedProducts(), useShopProducts() (+4 more)

### Community 8 - "useApiResource"
Cohesion: 0.18
Nodes (20): KpiCard(), DataTable(), Pagination(), SectionHeading(), TITLE_SIZES, StatusBadge(), toLabel(), TONE_BY_STATUS (+12 more)

### Community 9 - "main.jsx"
Cohesion: 0.23
Nodes (9): App(), ToastContext, ICON, ToastProvider(), TONES, AuthContext, AuthProvider(), readStoredToken() (+1 more)

### Community 10 - "Nanashi Collectibles Legacy README"
Cohesion: 0.11
Nodes (20): Canonical REST JWT Authentication, Checkout Idempotency Key, Database Ownership Policy, UI/UX Design Constitution, Known Technical Debt Summary, Marketplace Layer (Section 62), NanashiCollectibles Multi-Vertical Platform, orderStateMachine Module (+12 more)

### Community 11 - "package.json"
Cohesion: 0.10
Nodes (19): name, private, type, version, autoprefixer, babel-plugin-react-compiler, cors, eslint (+11 more)

### Community 12 - "merchantApi.js"
Cohesion: 0.12
Nodes (30): addStaff(), authHeaders(), confirmOrderPayment(), deleteBankDetails(), getDashboard(), getFulfilmentMethods(), getMe(), getNotificationSettings() (+22 more)

### Community 13 - "merchantProductSocketService.js"
Cohesion: 0.23
Nodes (12): archiveProduct(), createProduct(), getProductById(), listProducts(), updateProduct(), useMerchantProduct(), MerchantProductDetailPage(), handleArchive() (+4 more)

### Community 14 - "MerchantOrderDetailPage.jsx"
Cohesion: 0.11
Nodes (12): OrderStatusPanel(), Modal(), SIZES, formatDateTime(), MERCHANT_ORDER_TRANSITIONS, nextStatusOptions(), AdminAuditLogPage(), describeEntry() (+4 more)

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
Cohesion: 0.10
Nodes (20): AgingTile(), CommissionReceivableSection(), defaultPeriod(), IssueStatementModal(), handleSubmit(), PAYMENT_METHOD_LABELS, RecordPaymentModal(), handleSubmit() (+12 more)

### Community 20 - "Step 6 - Obsidian Vault + HTML Export"
Cohesion: 0.22
Nodes (9): Token Reduction Benchmark, FalkorDB Export / Push, Graphify MCP Stdio Server, Neo4j Export / Push, SVG / GraphML Export, Wiki Export (--wiki), Manifest Stamp-On-Output-Only Rule (#2015), Step 6 - Obsidian Vault + HTML Export (+1 more)

### Community 21 - "Step 0 - GitHub Repos and Multi-Path Merge"
Cohesion: 0.25
Nodes (9): graphify clone <github-url>, graphify merge-graphs, Monorepo Subfolder Extraction Flow, graphify.transcribe.transcribe_all, Whisper Domain-Hint Prompt, Step 0 - GitHub Repos and Multi-Path Merge, Step 1 - Ensure Graphify Is Installed, Step 2.5 - Video and Audio Transcription (+1 more)

### Community 22 - "TicketingDemo.jsx"
Cohesion: 0.08
Nodes (31): DemoCheckoutSummary(), DemoHoldCountdown(), formatClock(), CATEGORY_CODE, DEMO_ACCESSIBLE_SEATS, DEMO_GA_AVAILABLE, DEMO_UNAVAILABLE_SEATS, seatCode() (+23 more)

### Community 23 - "InventoryAdjustModal"
Cohesion: 0.67
Nodes (3): InventoryAdjustModal(), handleSubmit(), adjustInventory()

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

### Community 49 - "react-router-dom"
Cohesion: 0.05
Nodes (64): react-router-dom, CartItemRow(), OrderSummary(), ProductsSlot(), Section(), SPACING, TONES, QuantityStepper() (+56 more)

### Community 50 - "AdminLayout.jsx"
Cohesion: 0.10
Nodes (17): AdminLayout(), AdminMobileDrawer(), ADMIN_NAV, AdminNavLinks(), AdminSidebar(), MerchantLayout(), MerchantMobileDrawer(), ALL_ROLES (+9 more)

### Community 52 - "emitWithAck"
Cohesion: 0.18
Nodes (12): listNews(), useNews(), listServices(), listDecklists(), listTcgGames(), listTrades(), useDecklists(), useTcgGames() (+4 more)

### Community 53 - "useAuth"
Cohesion: 0.16
Nodes (10): socket.io-client, AccountMenu(), AuthControls(), useAuth(), MerchantAuthContext, MerchantAuthProvider(), normalizeMembership(), MerchantRoot() (+2 more)

### Community 55 - "react"
Cohesion: 0.16
Nodes (21): react, EMPTY_FORM, REASONS_BY_TYPE, TYPE_OPTIONS, Button(), SIZES, VARIANTS, Card (+13 more)

### Community 56 - "MerchantSettingsBankPage.jsx"
Cohesion: 0.12
Nodes (19): RoleGate(), useToast(), useMerchantAuth(), MerchantInventoryPage(), FEATURES, MerchantPortalPage(), primaryAction(), BANKS (+11 more)

### Community 58 - "EsportsPage.jsx"
Cohesion: 0.16
Nodes (15): SkeletonCard(), IndividualJoinForm(), handleJoin(), TeamJoinForm(), handleJoin(), TournamentRegistrationForm(), handleLeave(), joinTournament() (+7 more)

### Community 59 - "CartProvider.jsx"
Cohesion: 0.47
Nodes (10): CartProvider(), readGuestToken(), writeGuestToken(), addCartItem(), clearCart(), getCart(), mergeGuestCart(), removeCartItem() (+2 more)

### Community 60 - "createEnquiry"
Cohesion: 0.28
Nodes (6): createEnquiry(), ContactPage(), handleSubmit(), categoryForKey(), QuotationForm(), handleSubmit()

### Community 61 - "Skeleton.jsx"
Cohesion: 0.38
Nodes (3): EmptyState(), SkeletonText(), STATUS_ORDER

### Community 62 - "authService.js"
Cohesion: 0.39
Nodes (7): AuthError, forgotPassword(), login(), me(), register(), request(), resetPassword()

### Community 64 - "WishlistProvider.jsx"
Cohesion: 0.50
Nodes (6): WishlistContext, WishlistProvider(), addToWishlist(), getWishlist(), removeFromWishlist(), request()

### Community 65 - "Footer.jsx"
Cohesion: 0.33
Nodes (4): Footer(), Layout(), Header(), footerNav

## Ambiguous Edges - Review These
- `NanashiCollectibles App Shell (index.html)` → `Nanashi Collectibles Legacy README`  [AMBIGUOUS]
  index.html · relation: conceptually_related_to
- `NanashiCollectibles Multi-Vertical Platform` → `Nanashi Collectibles Legacy README`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **154 isolated node(s):** `21st`, `name`, `private`, `version`, `type` (+149 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 269 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `NanashiCollectibles App Shell (index.html)` and `Nanashi Collectibles Legacy README`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `NanashiCollectibles Multi-Vertical Platform` and `Nanashi Collectibles Legacy README`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `react` to `ShopPage.jsx`, `Header.jsx`, `ProductForm.jsx`, `App.jsx`, `CheckoutPage.jsx`, `ProductCard.jsx`, `BlackHoleHeroSection`, `useSocket`, `useApiResource`, `main.jsx`, `package.json`, `merchantProductSocketService.js`, `MerchantOrderDetailPage.jsx`, `AdminMerchantDetailPage.jsx`, `TicketingDemo.jsx`, `react-router-dom`, `AdminLayout.jsx`, `emitWithAck`, `useAuth`, `MerchantSettingsBankPage.jsx`, `EsportsPage.jsx`, `CartProvider.jsx`, `Skeleton.jsx`, `WishlistProvider.jsx`?**
  _High betweenness centrality (0.229) - this node is a cross-community bridge._
- **Why does `react-router-dom` connect `react-router-dom` to `ShopPage.jsx`, `Footer.jsx`, `ProductForm.jsx`, `App.jsx`, `Header.jsx`, `ProductCard.jsx`, `CheckoutPage.jsx`, `useApiResource`, `main.jsx`, `package.json`, `merchantProductSocketService.js`, `MerchantOrderDetailPage.jsx`, `AdminLayout.jsx`, `AdminMerchantDetailPage.jsx`, `useAuth`, `react`, `Skeleton.jsx`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `Button()` connect `react` to `ShopPage.jsx`, `Header.jsx`, `ProductForm.jsx`, `App.jsx`, `CheckoutPage.jsx`, `useSocket`, `useApiResource`, `MerchantOrderDetailPage.jsx`, `react-router-dom`, `AdminLayout.jsx`, `AdminMerchantDetailPage.jsx`, `TicketingDemo.jsx`, `MerchantSettingsBankPage.jsx`, `EsportsPage.jsx`, `Skeleton.jsx`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `21st`, `name`, `private` to the rest of the system?**
  _154 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ShopPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11688311688311688 - nodes in this community are weakly interconnected._