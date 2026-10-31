# Graph Report - nanashicollectibles  (2026-09-16)

## Corpus Check
- 224 files · ~672,407 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: (none) 1, .css 1)

## Summary
- 933 nodes · 2841 edges · 63 communities (45 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `204ca5af`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- RvsSection.jsx
- useApiResource
- ShopPage.jsx
- App.jsx
- CheckoutPage.jsx
- BlackHoleHeroSection
- CartProvider.jsx
- useSocket
- react
- InteractiveSeatingSection.jsx
- Nanashi Collectibles Legacy README
- package.json
- merchantApi.js
- ServiceDetailPage.jsx
- Button
- devDependencies
- adminApi.js
- /graphify Command
- dependencies
- MerchantProductDetailPage.jsx
- Step 6 - Obsidian Vault + HTML Export
- Step 0 - GitHub Repos and Multi-Path Merge
- TicketingDemo.jsx
- ProductForm.jsx
- SectionHeading.jsx
- Part B - Semantic Extraction (Parallel Subagents)
- Extraction Subagent Prompt Template
- Step 4 - Build Graph, Cluster, Analyze
- eslint.config.js
- scripts
- Nanashi Homepage Design Reference (screenshot)
- BFS/DFS Graph Traversal
- vite
- merchantStatusTransitions.js
- TcgSection.jsx
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
- TcgPage.jsx
- Button.jsx
- MerchantSettingsBankPage.jsx
- AdminNavLinks.jsx
- merchantProductSocketService.js
- AdminMerchantDetailPage.jsx
- ContactPage.jsx
- MerchantOrderDetailPage.jsx
- ProductDetailPage.jsx
- ProductImageEditor.jsx
- LoginPage.jsx
- BankAccountsSection
- BankAccountForm
- TournamentRegistrationForm.jsx

## God Nodes (most connected - your core abstractions)
1. `react` - 84 edges
2. `Button()` - 62 edges
3. `react-router-dom` - 61 edges
4. `useApiResource()` - 44 edges
5. `useSocket()` - 42 edges
6. `useAuth()` - 38 edges
7. `useMerchantAuth()` - 38 edges
8. `Card` - 37 edges
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

## Communities (63 total, 18 thin omitted)

### Community 0 - "RvsSection.jsx"
Cohesion: 0.18
Nodes (15): SkeletonCard(), formatDate(), formatDateTime(), formatEntryFee(), TournamentCard(), useTournaments(), TournamentDetailPage(), STATUS_ORDER (+7 more)

### Community 1 - "useApiResource"
Cohesion: 0.18
Nodes (15): KpiCard(), formatDate(), formatMoney(), useMerchantAuth(), useApiResource(), AdminDashboardPage(), MerchantDashboardPage(), MerchantInventoryPage() (+7 more)

### Community 2 - "ShopPage.jsx"
Cohesion: 0.10
Nodes (15): MarketplaceEmptyState(), ProductFilters(), ProductGridSkeleton(), ProductSearch(), ProductSort(), SORT_OPTIONS, ShopHeader(), ShopSidebarFilters() (+7 more)

### Community 3 - "App.jsx"
Cohesion: 0.10
Nodes (16): Layout(), MerchantLayout(), AboutPage(), AdminMerchantsPage(), handleSearchSubmit(), updateParams(), MerchantLoginPage(), MerchantPayoutsPage() (+8 more)

### Community 4 - "CheckoutPage.jsx"
Cohesion: 0.06
Nodes (49): AddressSelectorModal(), EMPTY_FORM, ContactAddressCard(), DeliveryDetailsSection(), ALLOWED_TYPES, DeliveryReferencePhotoUpload(), handleFile(), RadioGroupField() (+41 more)

### Community 5 - "BlackHoleHeroSection"
Cohesion: 0.21
Nodes (14): BlackHoleHeroSection(), bind(), build(), compile(), draw(), dropTargets(), link(), makeTarget() (+6 more)

### Community 6 - "CartProvider.jsx"
Cohesion: 0.09
Nodes (35): socket.io-client, App(), ToastContext, ICON, ToastProvider(), TONES, AuthContext, AuthProvider() (+27 more)

### Community 7 - "useSocket"
Cohesion: 0.35
Nodes (8): RelatedProducts(), getProductBySlug(), listShopCategories(), useProduct(), useShopCategories(), ShopSection(), useFeaturedProducts(), useSocket()

### Community 8 - "react"
Cohesion: 0.11
Nodes (17): react, react-router-dom, AdminLayout(), Container(), SIZES, Footer(), AccountMenu(), CartLink() (+9 more)

### Community 9 - "InteractiveSeatingSection.jsx"
Cohesion: 0.15
Nodes (10): demoVenue, reservedCapacity, totalCapacity, InteractiveSeatingSection(), SeatMap(), ApplicationDevelopmentPage(), DroneServicesPage(), ServiceDetailPage() (+2 more)

### Community 10 - "Nanashi Collectibles Legacy README"
Cohesion: 0.11
Nodes (20): Canonical REST JWT Authentication, Checkout Idempotency Key, Database Ownership Policy, UI/UX Design Constitution, Known Technical Debt Summary, Marketplace Layer (Section 62), NanashiCollectibles Multi-Vertical Platform, orderStateMachine Module (+12 more)

### Community 11 - "package.json"
Cohesion: 0.10
Nodes (19): name, private, type, version, autoprefixer, babel-plugin-react-compiler, cors, eslint (+11 more)

### Community 12 - "merchantApi.js"
Cohesion: 0.10
Nodes (34): addStaff(), authHeaders(), confirmOrderPayment(), deleteBankDetails(), getDashboard(), getFulfilmentMethods(), getMe(), getNotificationSettings() (+26 more)

### Community 13 - "ServiceDetailPage.jsx"
Cohesion: 0.20
Nodes (11): SpotlightCard(), businessPillars, serviceProcess, services, shopCategories, site, tcgGames, SERVICE_ICON (+3 more)

### Community 14 - "Button"
Cohesion: 0.16
Nodes (18): Section(), SPACING, TONES, Badge(), TONES, Button(), Card, PADDING (+10 more)

### Community 15 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, babel-plugin-react-compiler, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals (+7 more)

### Community 16 - "adminApi.js"
Cohesion: 0.30
Nodes (10): AdminApiError, authHeaders(), getAuditLog(), getDashboardStats(), getMerchant(), getMerchants(), getMerchantStats(), request() (+2 more)

### Community 17 - "/graphify Command"
Cohesion: 0.22
Nodes (11): Graphify Skill Pointer, /graphify add <url>, --watch Folder Auto-Rebuild, graphify claude install (Native CLAUDE.md Integration), graphify hook install (Post-Commit Auto-Rebuild), /graphify explain, /graphify path, --cluster-only (+3 more)

### Community 18 - "dependencies"
Cohesion: 0.18
Nodes (11): dependencies, cors, express, framer-motion, lightweight-charts, mysql2, react, react-dom (+3 more)

### Community 19 - "MerchantProductDetailPage.jsx"
Cohesion: 0.25
Nodes (7): RevenueTrendChart(), EmptyState(), SkeletonText(), useToast(), isValidE164(), handleSave(), MerchantSettingsProfilePage()

### Community 20 - "Step 6 - Obsidian Vault + HTML Export"
Cohesion: 0.22
Nodes (9): Token Reduction Benchmark, FalkorDB Export / Push, Graphify MCP Stdio Server, Neo4j Export / Push, SVG / GraphML Export, Wiki Export (--wiki), Manifest Stamp-On-Output-Only Rule (#2015), Step 6 - Obsidian Vault + HTML Export (+1 more)

### Community 21 - "Step 0 - GitHub Repos and Multi-Path Merge"
Cohesion: 0.25
Nodes (9): graphify clone <github-url>, graphify merge-graphs, Monorepo Subfolder Extraction Flow, graphify.transcribe.transcribe_all, Whisper Domain-Hint Prompt, Step 0 - GitHub Repos and Multi-Path Merge, Step 1 - Ensure Graphify Is Installed, Step 2.5 - Video and Audio Transcription (+1 more)

### Community 22 - "TicketingDemo.jsx"
Cohesion: 0.08
Nodes (31): DemoCheckoutSummary(), DemoHoldCountdown(), formatClock(), CATEGORY_CODE, DEMO_ACCESSIBLE_SEATS, DEMO_GA_AVAILABLE, DEMO_UNAVAILABLE_SEATS, seatCode() (+23 more)

### Community 23 - "ProductForm.jsx"
Cohesion: 0.18
Nodes (10): ProductForm(), STATUS_OPTIONS, toEditorImages(), toFormState(), FieldHelp(), createProduct(), listProductCategories(), useProductCategories() (+2 more)

### Community 24 - "SectionHeading.jsx"
Cohesion: 0.23
Nodes (11): DataTable(), Pagination(), SectionHeading(), TITLE_SIZES, StatusBadge(), toLabel(), TONE_BY_STATUS, ACTIONS (+3 more)

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

### Community 35 - "TcgSection.jsx"
Cohesion: 0.22
Nodes (10): BlurFade(), FinalCta(), Hero(), TRUST_ROW, useNarrowViewport(), MerchantCta(), ServicesSection(), STATS (+2 more)

### Community 49 - "TcgPage.jsx"
Cohesion: 0.15
Nodes (14): DecklistCard(), excerpt(), NewsListItem(), TradeListingCard(), listNews(), useNews(), listDecklists(), listTcgGames() (+6 more)

### Community 50 - "Button.jsx"
Cohesion: 0.18
Nodes (9): AdminMobileDrawer(), AdminNavLinks(), AdminSidebar(), MerchantMobileDrawer(), MerchantTopbar(), SIZES, VARIANTS, SIZES (+1 more)

### Community 51 - "MerchantSettingsBankPage.jsx"
Cohesion: 0.12
Nodes (18): REASONS_BY_TYPE, TYPE_OPTIONS, RoleGate(), borderClasses(), CheckboxField(), FileUploadField(), SelectField(), TextareaField() (+10 more)

### Community 52 - "AdminNavLinks.jsx"
Cohesion: 0.17
Nodes (8): ADMIN_NAV, ALL_ROLES, MERCHANT_NAV, navForRole(), MerchantNavIcon(), PATHS, MerchantNavLinks(), MerchantSidebar()

### Community 53 - "merchantProductSocketService.js"
Cohesion: 0.21
Nodes (12): InventoryAdjustModal(), handleSubmit(), adjustInventory(), archiveProduct(), getProductById(), listProducts(), updateProduct(), useMerchantProduct() (+4 more)

### Community 54 - "AdminMerchantDetailPage.jsx"
Cohesion: 0.16
Nodes (8): formatDateTime(), AdminAuditLogPage(), describeEntry(), AdminMerchantDetailPage(), parseSocialLinks(), REASON_OPTIONS, REVIEW_COPY, STATUS_ACTIONS

### Community 55 - "ContactPage.jsx"
Cohesion: 0.22
Nodes (9): createEnquiry(), listServices(), ContactPage(), handleSubmit(), ENQUIRY_TYPES, QUICK_LINKS, categoryForKey(), QuotationForm() (+1 more)

### Community 56 - "MerchantOrderDetailPage.jsx"
Cohesion: 0.27
Nodes (6): OrderStatusPanel(), MERCHANT_ORDER_TRANSITIONS, nextStatusOptions(), CONFIRM_BUTTON_LABELS, CONFIRMABLE_PAYMENT_STATUSES, PAYMENT_METHOD_LABELS

### Community 57 - "ProductDetailPage.jsx"
Cohesion: 0.07
Nodes (30): CartItemRow(), OrderSummary(), ProductsSlot(), FulfilmentMethodCards(), TYPE_LABELS, FeaturedRail(), isRecentlyListed(), ProductCard() (+22 more)

### Community 58 - "ProductImageEditor.jsx"
Cohesion: 0.31
Nodes (5): ALLOWED_TYPES, fileToBase64(), ProductImageEditor(), handleFiles(), uploadProductImage()

### Community 59 - "LoginPage.jsx"
Cohesion: 0.39
Nodes (5): LoginPage(), handleSubmit(), RegisterPage(), handleSubmit(), safeRedirect()

### Community 67 - "TournamentRegistrationForm.jsx"
Cohesion: 0.27
Nodes (9): IndividualJoinForm(), handleJoin(), TeamJoinForm(), handleJoin(), TournamentRegistrationForm(), handleLeave(), joinTournament(), leaveTournament() (+1 more)

## Ambiguous Edges - Review These
- `NanashiCollectibles App Shell (index.html)` → `Nanashi Collectibles Legacy README`  [AMBIGUOUS]
  index.html · relation: conceptually_related_to
- `NanashiCollectibles Multi-Vertical Platform` → `Nanashi Collectibles Legacy README`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **148 isolated node(s):** `21st`, `name`, `private`, `version`, `type` (+143 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 261 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `NanashiCollectibles App Shell (index.html)` and `Nanashi Collectibles Legacy README`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `NanashiCollectibles Multi-Vertical Platform` and `Nanashi Collectibles Legacy README`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `react` to `RvsSection.jsx`, `ShopPage.jsx`, `CheckoutPage.jsx`, `BlackHoleHeroSection`, `CartProvider.jsx`, `useSocket`, `InteractiveSeatingSection.jsx`, `package.json`, `merchantApi.js`, `ServiceDetailPage.jsx`, `Button`, `MerchantProductDetailPage.jsx`, `TicketingDemo.jsx`, `ProductForm.jsx`, `SectionHeading.jsx`, `TcgSection.jsx`, `TcgPage.jsx`, `Button.jsx`, `MerchantSettingsBankPage.jsx`, `merchantProductSocketService.js`, `AdminMerchantDetailPage.jsx`, `ContactPage.jsx`, `MerchantOrderDetailPage.jsx`, `ProductDetailPage.jsx`, `ProductImageEditor.jsx`, `LoginPage.jsx`, `TournamentRegistrationForm.jsx`?**
  _High betweenness centrality (0.227) - this node is a cross-community bridge._
- **Why does `react-router-dom` connect `react` to `RvsSection.jsx`, `useApiResource`, `ShopPage.jsx`, `App.jsx`, `CheckoutPage.jsx`, `CartProvider.jsx`, `package.json`, `merchantApi.js`, `ServiceDetailPage.jsx`, `Button`, `MerchantProductDetailPage.jsx`, `ProductForm.jsx`, `SectionHeading.jsx`, `TcgSection.jsx`, `TcgPage.jsx`, `Button.jsx`, `AdminNavLinks.jsx`, `AdminMerchantDetailPage.jsx`, `ContactPage.jsx`, `MerchantOrderDetailPage.jsx`, `ProductDetailPage.jsx`, `LoginPage.jsx`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `Button()` connect `Button` to `RvsSection.jsx`, `useApiResource`, `ShopPage.jsx`, `CheckoutPage.jsx`, `useSocket`, `react`, `InteractiveSeatingSection.jsx`, `ServiceDetailPage.jsx`, `MerchantProductDetailPage.jsx`, `TicketingDemo.jsx`, `ProductForm.jsx`, `SectionHeading.jsx`, `TcgSection.jsx`, `TcgPage.jsx`, `Button.jsx`, `MerchantSettingsBankPage.jsx`, `AdminMerchantDetailPage.jsx`, `ContactPage.jsx`, `MerchantOrderDetailPage.jsx`, `ProductDetailPage.jsx`, `LoginPage.jsx`, `TournamentRegistrationForm.jsx`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `21st`, `name`, `private` to the rest of the system?**
  _148 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ShopPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10317460317460317 - nodes in this community are weakly interconnected._