# CLAUDE.md

This file provides operational guidance to Claude Code when working with this repository.

Treat this document as the project's current operating contract.

---

# 1. Project Overview

* **Project name:** NanashiCollectibles
* **Brand:** NanashiCollectibles is the confirmed frontend/business brand.
* **Repository context:** This frontend is one application inside the `GamerTavern` monorepo.
* **Git root:** One directory above this folder.
* **Related sibling projects:**

  * `Backend/`
  * `Database/`
  * unrelated `Portfolio_*` sites

## Product direction

NanashiCollectibles is intended to support multiple business verticals rather than a single niche.

Current/planned areas include:

* TCG ecommerce
* TCG community
* collectibles
* Gunpla
* drone-related products/services
* computer parts
* professional drone services
* website development
* application development
* esports
* tournament registration
* future Nanashi business verticals

The first actively implemented vertical is:

**RVS Esports → Tournament registration**

The product must not be architected or visually designed as though Nanashi is only:

* a gaming brand
* a TCG store
* an esports organization
* a drone company
* a software agency

The master platform must remain adaptable to future business categories.

---

# 2. Current Development Status

Completed:

* Phase 1 — frontend foundation
* Phase 2 — authentication architecture + Tournament as first live vertical
* Phase 3A — Socket.IO authentication and authorization hardening
* backend migration to the redesigned `NanashiCollectibles_v2` database contract

Current backend code queries the v2 schema exclusively.

The legacy tables in `Database/All.sql`, including old models such as:

* `PERSONAL_USER`
* `TOURNAMENT`
* related legacy tables

are no longer used by live backend code.

## Important verification status

The v2 database design and backend migration have been reviewed and syntax-checked.

However:

**Real integration testing against an actual MySQL instance using the v2 schema has not yet been completed.**

Until the owner provisions and validates the v2 database, treat the migration as:

> code-reviewed and contract-tested, but not production-verified against real MySQL.

Do not represent it as fully production-verified.

---

# 3. Repository Structure

```text
NanashiCollectibles/
├── src/
│   ├── app/
│   │   └── App.jsx
│   │
│   ├── main.jsx
│   │
│   ├── config/
│   │   └── site.js
│   │
│   ├── components/
│   │   ├── layout/
│   │   ├── navigation/
│   │   └── ui/
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── AuthContext.js
│   │   │   ├── AuthProvider.jsx
│   │   │   ├── authService.js
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   │
│   │   └── tournament/
│   │       ├── tournamentService.js
│   │       ├── useTournaments.js
│   │       ├── TournamentCard.jsx
│   │       ├── TournamentRegistrationForm.jsx
│   │       └── format.js
│   │
│   ├── services/
│   │   └── socket/
│   │       ├── SocketContext.js
│   │       └── SocketProvider.jsx
│   │
│   └── pages/
│       ├── Home
│       ├── Shop
│       ├── Services
│       ├── Tcg
│       ├── Esports
│       ├── About
│       ├── Contact
│       ├── services/
│       └── esports/
│
├── index.html
├── vite.config.js
├── .env
└── CLAUDE.md
```

Sibling backend:

```text
../Backend/
├── server.js
├── routes/
│   └── api/
├── controllers/
├── modules/
│   ├── db.module.js
│   ├── mailer.module.js
│   ├── jwt.module.js
│   └── authz.module.js
├── env.example
└── public/
    └── uploads/
        ├── products/
        └── avatars/
```

Sibling database:

```text
../Database/
├── All.sql
├── All.dbml
├── All.dbdiagram
├── NanashiCollectibles_v2.sql
└── NanashiCollectibles_v2_seed.sql
```

## Canonical files

Current database schema:

```text
Database/NanashiCollectibles_v2.sql
```

Reference seed data:

```text
Database/NanashiCollectibles_v2_seed.sql
```

Legacy only:

```text
Database/All.sql
Database/All.dbml
Database/All.dbdiagram
```

Do not use the legacy schema as the source of truth for current backend behavior.

---

# 4. Technology Stack

## Frontend

* React 19.2
* React Router DOM 7.10
* Tailwind CSS 3.4
* ESLint 9
* `eslint-plugin-react-hooks@7`
* Socket.IO Client 4.8
* Vite through `rolldown-vite@7.2.5`

The React Hooks lint configuration includes strict rules such as:

* `set-state-in-effect`
* `refs`

Do not suppress these rules merely to silence lint errors.

Fix the architectural cause.

## Backend

* Node.js
* ESM
* Express 5
* Socket.IO 4
* `mysql2`
* `bcrypt`
* `bcryptjs`
* `jsonwebtoken`
* `cybersource-rest-client`
* `nodemailer`
* `multer`
* `nodemon`

`bcrypt` and `bcryptjs` are currently redundant and may eventually be consolidated.

## Database

* MySQL / MariaDB compatible design
* snake_case naming
* plural table names
* `INT UNSIGNED AUTO_INCREMENT` primary keys
* `utf8mb4_unicode_ci`

## Important backend environment warning

The old:

```text
Backend/.env.dev
```

may reference an externally hosted or production-like database.

Never use it casually for development or migration testing.

Do not run destructive or integration operations against a real database without explicit authorization.

---

# 5. Application Architecture

```text
React SPA
   │
   ├── REST fetch
   │     └── canonical authentication flows
   │
   └── socket.io-client
         └── realtime feature contracts
                 │
                 ▼
Express + Socket.IO
   │
   ├── io.use()
   │     └── JWT socket handshake
   │
   ├── REST routes
   │
   └── Socket.IO controllers
         │
         ▼
mysql2 pool
         │
         ▼
NanashiCollectibles_v2 MySQL schema
```

## Socket identity

`Backend/server.js` uses Socket.IO middleware.

A valid JWT produces:

```js
socket.user = {
  id,
  email,
  name,
  role
}
```

Unauthenticated or invalid-token connections result in:

```js
socket.user = null
```

Connections are not rejected solely because authentication is absent.

Authorization is enforced per operation.

Never trust user identity supplied through event payloads.

Identity must come from:

```js
socket.user
```

---

# 6. Routing

Current main application routes include:

```text
/
 /shop
 /services
 /services/...
 /tcg
 /about
 /contact
 /login
 /register
 /esports
 /esports/tournaments
 /esports/tournaments/:id
 *
```

## Esports

```text
/esports
```

RVS Esports landing.

```text
/esports/tournaments
```

Live tournament listing.

```text
/esports/tournaments/:id
```

Tournament detail and registration.

The registration form is selected automatically from:

```text
tournament.registration_type
```

Supported values:

```text
individual
team
```

---

# 7. Current Frontend Data Flow

Use:

```text
src/config/site.js
```

as the frontend source of truth for static business/domain configuration.

It also provides the reference values used to generate:

```text
Database/NanashiCollectibles_v2_seed.sql
```

## API responsibilities

Use:

```text
authService.js
```

for REST authentication.

Use feature-level service wrappers for Socket.IO interactions.

Use:

```text
SocketProvider
```

as the central socket connection owner.

Do not create unrelated parallel Socket.IO clients inside individual pages.

## Tournament realtime events

`useTournaments.js` must account for relevant events including:

```text
tournament:created
tournament:updated
tournament:deleted
tournament:participants_updated
tournament:teams_updated
```

Do not remove `tournament:teams_updated`.

Team registrations depend on this event for live UI updates.

---

# 8. Authentication and Authorization

## Canonical authentication

REST authentication is canonical.

Relevant implementation:

```text
Backend/routes/api/auth.routes.js
Backend/modules/jwt.module.js
```

Canonical REST auth includes:

* register
* login
* `/me`
* forgot password
* reset password

## Public user contract

Register and login must return a consistent public user shape.

Canonical shape:

```js
{
  sub,
  email,
  name,
  role
}
```

Do not return raw database rows to the frontend.

Use the shared public-user normalization logic.

## Login status enforcement

Login rejects users whose:

```text
users.status
```

is not:

```text
active
```

Status should only be checked after successful password verification.

This avoids exposing unnecessary account-status information to unauthenticated probes.

## Last login

Successful login updates:

```text
users.last_login_at
```

This update is best-effort.

Failure to update the timestamp should not invalidate an otherwise valid login.

---

# 9. Password Reset

Canonical REST endpoints:

```text
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

Storage:

```text
password_reset_tokens
```

Only the SHA-256 hash of the reset token is stored.

The raw token must not be stored in the database.

Current implementation does not yet include normal production email delivery for reset tokens.

Do not silently represent password reset as production-complete until delivery behavior is implemented appropriately.

## Legacy duplication

These socket events currently duplicate canonical REST behavior:

```text
account:requestReset
account:resetPassword
```

They are technical debt and should eventually be removed once no frontend dependency remains.

---

# 10. Authorization Rules

Use:

```text
Backend/modules/authz.module.js
```

Canonical helpers include:

```text
requireAuthenticated
requireAdmin
requireOwnerOrAdmin
```

Every protected write must derive identity from verified server-side socket/auth context.

Never authorize based on client-submitted:

```text
userId
accountId
ownerId
role
email
```

unless the server independently verifies it against authenticated identity.

Client-supplied ownership fields are data, not authority.

---

# 11. Backend Domain Contract

Current v2 domain mapping:

| Domain             | Current table(s)                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Identity           | `users`, `password_reset_tokens`                                                         |
| Countries          | `countries`                                                                              |
| TCG games          | `tcg_games`                                                                              |
| Product categories | `product_categories`                                                                     |
| Products           | `products`, `product_images`                                                             |
| Inventory          | `inventory_movements`                                                                    |
| Deck lists         | `deck_lists`                                                                             |
| Trades             | `trade_listings`                                                                         |
| Tournaments        | `tournaments`, `tournament_registrations`, `tournament_teams`, `tournament_team_members` |
| News               | `news`, `news_categories`                                                                |
| Services           | `services`                                                                               |
| Enquiries          | `enquiries`                                                                              |

---

# 12. Product and Inventory Rules

Products use normalized category relationships.

Do not restore legacy free-text category behavior.

Use:

```text
category_id
tcg_game_id
```

where applicable.

## Product price

Product price uses:

```text
DECIMAL(10,2)
```

Do not regress it to integer storage.

## Images

Products use:

```text
product_images
```

for multiple images.

Important fields include ordering and primary-image behavior.

Do not reintroduce a cached:

```text
products.image_url
```

column merely for convenience.

Query the normalized image table.

## Inventory

Inventory changes are represented through:

```text
inventory_movements
```

Do not treat inventory as a duplicate mirrored stock table.

Inventory adjustment should:

* lock the relevant product/stock row
* calculate the new quantity
* reject invalid negative outcomes

Do not silently clamp negative stock to zero.

---

# 13. Tournament Contract

`tournaments.registration_type` supports:

```text
individual
team
```

The schema and backend must not hard-code Apex Legends or a specific team size.

---

## Individual registration

One participant creates one:

```text
tournament_registrations
```

row.

For individual tournaments:

```text
max_entries
```

counts participants.

---

## Team registration

A team consists of:

```text
tournament_teams
tournament_registrations
tournament_team_members
```

`tournament_registrations` remains the participation ledger.

A team is a grouping of registrations.

For team tournaments:

```text
max_entries
```

counts teams, not players.

## Team join payload

The current team join flow accepts values conceptually equivalent to:

```js
{
  teamName,
  guestName,
  nickname,
  teammates: [
    {
      guestName,
      nickname
    }
  ]
}
```

The authenticated caller is always the captain.

If authenticated, their identity comes from:

```text
socket.user
```

Otherwise they provide their own guest identity.

Additional teammates are guest entries.

Do not allow the submitter to claim another registered user's identity without a real invite/accept mechanism.

---

# 14. Tournament Transaction Rules

Team creation must remain atomic.

The following belong inside one database transaction:

* team creation
* captain registration
* teammate registrations
* team membership links
* captain assignment

If one operation fails, the entire operation must roll back.

Do not permit partially created teams.

---

# 15. Tournament Captain Integrity

`tournament_teams.captain_registration_id` references a registration.

The database uses a normal FK on:

```text
captain_registration_id
```

Do not recreate the previously rejected composite FK design using:

```text
(captain_registration_id, tournament_id)
```

with `ON DELETE SET NULL`.

That design conflicts with MySQL behavior when the composite includes a non-nullable `tournament_id`.

The invariants:

* captain belongs to the tournament
* captain belongs to the team

are enforced by backend transaction/application logic.

Preserve those checks.

---

# 16. Tournament Leave Rules

`tournament:leave` may conceptually support:

```text
participantId
teamId
neither
```

Behavior:

### `participantId`

Remove a participant when authorization allows:

* owner/self
* admin

### `teamId`

Withdraw the entire team when caller is:

* team captain
* admin

Team withdrawal deletes member registrations and related membership records correctly through transactional/cascade behavior.

### Neither

Remove the authenticated caller's own registration.

Do not weaken authorization on these paths.

---

# 17. Known Tournament Concurrency Risk

A known technical debt item remains:

**capacity and duplicate-registration checks occur before the write and are vulnerable to a TOCTOU race.**

Under concurrent registrations, two requests may both pass validation before either commits.

This can theoretically allow:

* capacity overflow
* duplicate participation

The likely future fix is one of:

* row locking
* transactional re-check
* a dedicated capacity-tracking lock
* stronger unique/index constraints where applicable

Do not claim this race is solved unless the implementation actually changes.

---

# 18. News Rules

Public news reads return:

```text
status = published
```

Draft content must not be exposed to normal public users.

Administrative reads may access drafts where authorized.

News categories come from:

```text
news_categories
```

Do not restore hard-coded category arrays.

---

# 19. Services and Enquiries

Public services use:

```text
services:list
```

Enquiries use:

```text
enquiries:create
```

## PII rule

Enquiries contain personally identifiable information such as:

* name
* email
* phone
* message

Do not broadcast enquiry payloads globally over Socket.IO.

`enquiries:create` deliberately does not use a general:

```js
io.emit(...)
```

broadcast.

Preserve this privacy boundary.

---

# 20. Database Rules

Canonical schema:

```text
Database/NanashiCollectibles_v2.sql
```

Reference seed:

```text
Database/NanashiCollectibles_v2_seed.sql
```

Legacy:

```text
Database/All.sql
Database/All.dbml
Database/All.dbdiagram
```

## Database ownership policy

Database creation, import, migration execution, destructive SQL, and real database changes are manually controlled by the project owner.

Claude may:

* inspect SQL
* audit SQL
* design schemas
* recommend changes
* generate SQL
* review migrations

Claude must not independently:

* create a real schema
* drop a real schema
* import a real database
* modify production data
* truncate tables
* delete databases
* run destructive migration scripts
* connect to real database infrastructure

unless explicitly authorized for that specific action.

## System schemas

Never modify:

```text
information_schema
mysql
performance_schema
sys
```

---

# 21. Environment Configuration

Frontend:

```text
.env
.env.local
```

Backend:

```text
Backend/.env.dev
Backend/env.example
```

Do not:

* print secrets
* expose passwords
* expose JWT secrets
* commit sensitive environment values
* echo database credentials
* log tokens

When debugging environment problems, validate variable presence and format without unnecessarily displaying secret values.

---

# 22. Development Commands

## Frontend

Common commands:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

Current frontend has no dedicated automated test runner.

## Backend

Common commands:

```bash
npm install
npm run dev
npm run start
```

Current backend has no dedicated:

* build script
* lint script
* automated test suite

When real infrastructure is unavailable, syntax validation may use:

```bash
node --check <file>
```

Do not treat syntax validation as integration testing.

---

# 23. Frontend Engineering Rules

Treat the frontend as a maintained product, not as a blank-slate prototype.

Before making substantial frontend changes:

1. inspect the current page
2. inspect relevant components
3. search for reusable primitives
4. identify existing design patterns
5. identify dependencies
6. understand the existing data flow
7. preserve working contracts
8. make the smallest coherent change

Do not perform broad rewrites when a scoped improvement is sufficient.

---

## Component reuse

Before creating a reusable component, inspect:

```text
src/components/ui/
src/components/layout/
src/components/navigation/
src/features/
```

Prefer extending or composing existing primitives.

Avoid duplicate implementations of:

* Button
* Input
* Textarea
* Select
* Checkbox
* Radio
* Modal
* Dialog
* Drawer
* Card
* Badge
* Tabs
* Alert
* Toast
* Empty State
* Skeleton
* Spinner
* Page Header
* Navigation
* Pagination
* Form Field

Create a new primitive only when the existing abstraction cannot reasonably support the requirement.

---

# 24. React Rules

Use:

* functional components
* hooks
* clear composition
* narrow component responsibilities

Avoid:

* unnecessary `useEffect`
* derived values stored unnecessarily in state
* duplicated state
* premature memoization
* deeply coupled page components
* hidden side effects

Page components should primarily orchestrate:

* data
* layout
* features

Move reusable logic into:

* hooks
* services
* helpers
* components

## ESLint

Do not suppress React Hooks lint rules merely to make a warning disappear.

Fix the dependency, state, effect, or architectural issue correctly.

---

# 25. Styling Rules

The frontend currently uses:

```text
Tailwind CSS
```

Prefer:

* Tailwind utilities
* reusable component variants
* shared design tokens
* existing project abstractions

Avoid:

* excessive inline style objects
* duplicated hard-coded style values
* arbitrary CSS files for trivial Tailwind-supported styling
* unnecessary new styling frameworks

Avoid excessive arbitrary Tailwind values such as:

```text
mt-[37px]
w-[413px]
gap-[19px]
```

unless the design genuinely requires them.

Use consistent scales whenever possible.

---

# 26. UI / UX Design Constitution

Claude must approach meaningful UI work as both:

* a senior frontend engineer
* a senior product designer

The objective is not merely:

> make it modern

The interface should feel:

* intentional
* professional
* coherent
* trustworthy
* polished
* visually balanced
* responsive
* usable
* production-ready
* human-designed

The UI must avoid the stereotypical appearance of an automatically generated or "vibe-coded" application.

---

# 27. Mandatory Design Workflow

For substantial redesign tasks:

```text
Audit
↓
Problem identification
↓
Information hierarchy
↓
Component strategy
↓
Design direction
↓
Implementation
↓
Responsive review
↓
Accessibility review
↓
Visual refinement
```

Do not immediately rewrite JSX after seeing a screenshot.

First understand what is actually wrong.

For small UI fixes, use judgment and avoid unnecessary ceremony.

---

# 28. Design Audit Criteria

When auditing a page, inspect:

* information hierarchy
* spacing
* alignment
* typography
* color usage
* contrast
* grouping
* visual density
* navigation
* primary CTA
* secondary actions
* form usability
* component consistency
* loading states
* empty states
* error states
* responsive behavior
* accessibility
* motion
* user feedback

Significant design decisions should be explainable as:

```text
Problem
→ Design decision
→ User benefit
```

Do not redesign something solely because another design looks newer.

---

# 29. Avoid Generic AI / Vibe-Coded Design

Do not automatically use fashionable effects merely because they are visually impressive.

Avoid excessive:

* gradients
* glassmorphism
* neon
* glowing borders
* blurred blobs
* animated backgrounds
* giant headings
* unnecessary floating shapes
* cards inside cards
* excessive rounded rectangles
* excessive shadows
* excessive pill components
* random icons
* dashboard metrics without real meaning
* meaningless decorations
* animation on every element

A page must not resemble a component-library demonstration.

Every visual effect should support at least one of:

* hierarchy
* branding
* comprehension
* interaction
* feedback
* storytelling

If removing an effect improves clarity, remove it.

---

# 30. Information Hierarchy

Each page should answer quickly:

1. Where am I?
2. What is this page for?
3. What matters most?
4. What can I do here?
5. What should I do next?

Do not give every component equal visual weight.

Primary actions should clearly dominate secondary actions.

Destructive actions must be visually distinguishable and must not compete with normal primary actions.

Supporting information should not overpower core content.

---

# 31. Spacing System

Prefer a consistent spacing rhythm based approximately on:

```text
4
8
12
16
24
32
48
64
96
```

These values are guidance rather than absolute constraints.

Spacing should communicate relationships.

Example:

```text
related content
→ small spacing

separate concepts
→ medium spacing

major sections
→ large spacing
```

Whitespace is structural.

Do not fill empty space merely to make a layout appear busy.

---

# 32. Typography

Maintain a restrained hierarchy.

Typical roles:

```text
Display / Hero
Page title
Section heading
Component heading
Body
Supporting text
Metadata
Caption
```

Avoid excessive combinations of:

* font size
* font weight
* uppercase
* letter spacing

Do not make every heading:

* bold
* oversized
* uppercase

Prioritize readability.

Maintain reasonable line lengths for body content.

---

# 33. Nanashi Visual Character

Nanashi is a broad umbrella brand.

Its UI should feel capable of supporting:

* ecommerce
* professional services
* community
* technology
* gaming
* esports
* collectibles
* future industries

Preferred visual character:

* modern
* confident
* clean
* structured
* technology-aware
* premium without being luxury-only
* gaming-aware without looking like an esports clan page
* expressive without becoming noisy

Avoid locking the identity entirely to:

* cyberpunk
* anime
* TCG
* RGB gaming
* drone visuals
* developer aesthetics

Brand expression should be deliberate rather than saturated across every component.

---

# 34. Color Rules

Use color structurally.

Color should communicate:

* brand
* hierarchy
* state
* emphasis
* feedback

Do not assign unrelated colors merely for visual variety.

Maintain clear semantic meaning for:

* success
* warning
* error
* information
* neutral
* primary action
* secondary action

Avoid overusing the primary brand color.

A strong brand color becomes more effective when used selectively.

---

# 35. Responsive Design

Every meaningful UI feature must work across:

* mobile
* tablet
* desktop

Do not simply shrink desktop layouts.

Responsive design may require structural changes.

Example:

```text
Desktop
sidebar + main content

Mobile
drawer + stacked content
```

Example:

```text
Desktop
4-column product layout

Tablet
2-column layout

Mobile
1-column layout
```

Choose responsive behavior based on usability, not mechanical breakpoint conversion.

---

# 36. Mobile Requirements

Check:

* horizontal overflow
* clipped content
* touch target size
* navigation usability
* form readability
* keyboard collisions
* modal dimensions
* table usability
* fixed-position element collisions
* content order
* CTA visibility

Do not hide critical functionality merely to make mobile easier.

For wide data tables, intentionally choose between:

* horizontal scrolling
* responsive column reduction
* stacked representation
* card transformation

Do not allow accidental overflow.

---

# 37. Accessibility

Maintain:

* semantic HTML
* keyboard navigation
* visible focus indicators
* labels
* accessible form controls
* appropriate headings
* useful alt text
* adequate contrast
* meaningful button labels

Do not rely on color alone to communicate state.

Avoid clickable `<div>` elements when semantic controls such as:

```html
<button>
<a>
<input>
```

are appropriate.

---

# 38. Interactive States

Interactive components must consider:

```text
default
hover
active
focus
disabled
loading
```

Data-driven components should consider:

```text
loading
empty
success
error
```

Forms should consider:

```text
default
validation
submitting
success
failure
disabled
```

Do not implement only the happy path visually.

---

# 39. Motion and Interaction Rules

Animation is a communication tool.

Use motion to communicate:

* navigation
* hierarchy
* state change
* feedback
* spatial relationship
* element continuity

Do not animate something simply because animation is available.

---

## Preferred motion hierarchy

Use CSS transitions for simple interactions such as:

* color
* opacity
* transform
* hover feedback
* focus feedback

Use a dedicated motion library only when the interaction genuinely benefits from:

* spring physics
* enter/exit orchestration
* layout animation
* gesture interaction
* coordinated transitions
* complex sequences

---

## Motion timing

Typical interface transitions should generally remain within approximately:

```text
150–350ms
```

Longer animation may be appropriate for:

* major page transitions
* storytelling
* marketing sections

Avoid unnecessarily slow interaction.

---

## Avoid

* excessive bouncing
* constant floating
* repeated pulsing
* hover movement that causes layout shift
* excessive scale effects
* animating every child independently
* motion that delays user input
* animated decoration with no purpose

Respect reduced-motion preferences where practical.

---

# 40. Existing Motion Dependency

`framer-motion` is currently installed but unused.

Do not introduce it merely because the package exists.

Before using it, determine whether:

```text
CSS
```

is sufficient.

If motion becomes a deliberate architectural dependency across the project, document that decision in this file.

Do not mix multiple motion libraries without a clear reason.

---

# 41. Design Reference Rules

External references may inform the design.

They must not replace design reasoning.

Useful categories include:

* Mobbin — real product UX patterns
* 21st.dev — component inspiration
* Godly — visual web inspiration
* Aceternity UI — advanced interaction inspiration
* Motion documentation
* React Spring documentation

When using a reference, analyze:

* hierarchy
* spacing
* typography
* layout
* density
* component treatment
* navigation
* interaction
* responsive behavior
* motion philosophy

Do not blindly copy:

* branding
* proprietary content
* imagery
* entire layouts
* decorative effects
* page structure

Translate relevant principles into Nanashi's own system.

---

# 42. External Library Rules

Before adding a new UI or frontend dependency, evaluate:

* whether the project already solves the problem
* bundle impact
* accessibility
* maintenance burden
* compatibility
* styling conflicts
* long-term architecture

Do not install an entire UI framework to solve one component.

Do not mix multiple competing component systems without explicit justification.

Avoid turning the project into:

```text
Tailwind
+
MUI
+
shadcn
+
multiple animation libraries
+
random CSS frameworks
```

without architectural intent.

---

# 43. UI Completion Checklist

Before considering a substantial UI task complete, review:

## Structure

* Is the page purpose obvious?
* Is the information hierarchy clear?
* Is the primary CTA obvious?
* Are related elements grouped correctly?
* Is unnecessary content present?

## Visual design

* Is spacing consistent?
* Is alignment intentional?
* Is typography restrained?
* Is color usage coherent?
* Are there unnecessary effects?
* Is there enough whitespace?

## Components

* Were existing components reused?
* Were duplicate primitives created?
* Is repeated UI actually reusable?
* Is the component API unnecessarily complicated?

## States

Check:

* loading
* empty
* error
* success
* disabled

## Responsive

Check:

* mobile
* tablet
* desktop
* overflow
* navigation
* forms
* modals
* tables
* CTA positioning

## Accessibility

Check:

* keyboard
* focus
* labels
* contrast
* semantic HTML

## Interaction

Check:

* hover behavior
* click feedback
* async feedback
* motion purpose
* transition speed

## Final visual test

Ask:

> Does this look like one coherent product designed intentionally?

Do not optimize for:

> Does every individual component look impressive?

If the result feels:

* AI-generated
* noisy
* inconsistent
* overly decorative
* like a component-library showcase

simplify and refine it.

---

# 44. API Rules

Do not change frontend/backend contracts casually.

Before changing:

* REST endpoint
* Socket.IO event
* request shape
* response shape
* authentication structure
* database field name

inspect all consumers.

Search the repository for usage.

If a contract must change:

1. update backend
2. update frontend consumers
3. update validation
4. update relevant documentation
5. verify compatibility

Do not create silent contract drift.

---

# 45. Backend Modification Rules

Before editing a backend controller:

1. inspect current schema
2. inspect auth requirements
3. inspect all event listeners/callers
4. inspect transaction behavior
5. inspect emitted events
6. inspect privacy impact

Prefer explicit validation.

Do not trust incoming payloads.

Validate:

* required fields
* types
* allowed values
* ownership
* state transitions

---

# 46. SQL Rules

Always use parameterized queries.

Never concatenate untrusted input directly into SQL.

Prefer transactions when multiple related writes must remain consistent.

Use row locking where concurrency integrity requires it.

Prefer database constraints where they cleanly express invariants.

Examples:

* FK constraints
* unique constraints
* non-null constraints
* enum/check-style constraints where appropriate

Do not force a database constraint when the database cannot correctly express the required behavior.

Validate the actual MySQL semantics before relying on a complex FK.

---

# 47. Security Rules

Security takes priority over convenience.

Never weaken:

* authentication
* authorization
* ownership checks
* role checks
* token validation
* password handling
* PII boundaries

Never trust client-provided identity.

Never log:

* plaintext passwords
* password reset tokens
* JWT secrets
* database passwords
* complete authorization headers
* sensitive personal data unnecessarily

Do not broadcast private data through realtime events.

---

# 48. Debugging Rules

When debugging:

1. reproduce the problem
2. inspect the actual failing path
3. identify root cause
4. change the smallest appropriate area
5. verify affected behavior
6. check for regressions

Do not blindly rewrite working modules because one feature fails.

Avoid speculative fixes.

If a problem appears related to:

* DNS
* database connectivity
* authentication
* environment variables
* network access

distinguish infrastructure failures from application-code failures.

---

# 49. Modification Discipline

Before significant modifications:

* inspect the actual source
* understand dependencies
* identify blast radius
* preserve unrelated behavior

Avoid:

* unnecessary refactors
* unrelated formatting changes
* renaming unrelated files
* changing architecture while fixing a small bug

A focused patch is preferred when appropriate.

A larger refactor is justified only when the underlying architecture is the cause of the problem.

---

# 50. Vite Configuration Warning

The current:

```text
vite.config.js
```

contains an intentional:

```text
allowedHosts
```

configuration.

Do not remove, revert, or casually modify it.

Only change it when explicitly required and after understanding the deployment reason.

---

# 51. Files Requiring Extra Care

## `Backend/controllers/tournament.controller.js`

This is currently one of the most complex backend controllers.

It includes:

* individual registration
* team registration
* transactions
* captain logic
* capacity rules
* tournament state
* leave behavior

Changes here have a large blast radius.

Inspect thoroughly before modification.

---

## `Database/NanashiCollectibles_v2.sql`

This schema is the contract assumed by migrated backend code.

Changing column names, constraints, or relationships without corresponding backend changes will cause runtime failures.

Remember:

the schema has not yet been fully integration-tested against a real database.

---

## `Backend/server.js`

Contains global Socket.IO authentication middleware and controller wiring.

Changes can affect every realtime domain.

---

## Authentication modules

Extra care:

```text
Backend/routes/api/auth.routes.js
Backend/modules/jwt.module.js
Backend/modules/authz.module.js
```

Do not modify auth behavior casually.

---

# 52. Known Issues / Technical Debt

Confirmed:

### Database integration

The v2 schema has not yet been validated through full integration against a real MySQL instance.

This is the highest-priority infrastructure verification item.

### Tournament concurrency

Capacity and duplicate-registration checks contain a TOCTOU race.

Not yet fixed.

### Duplicate password reset paths

Socket:

```text
account:requestReset
account:resetPassword
```

duplicate canonical REST endpoints.

Consider removal once unused.

### Missing frontend verticals

Backend contracts exist but frontend implementation is incomplete for:

* Shop/product browsing
* TCG deck lists
* News
* Services
* Enquiries

### Admin frontend

Backend admin events exist, but there is currently no complete frontend administration UI for:

* tournaments
* products
* news
* other administrative features

### Legacy schema docs

These remain intentionally stale:

```text
Database/All.sql
Database/All.dbml
Database/All.dbdiagram
```

They document the retired schema.

### Dependencies

`bcrypt` and `bcryptjs` are both installed.

Potential future consolidation.

### Motion

`framer-motion` is installed but currently unused.

---

# 53. Current Architectural Decisions

These decisions remain in force unless explicitly revisited.

---

## Canonical authentication

REST JWT authentication is canonical.

Socket authentication derives from the JWT handshake.

Do not create a second incompatible identity system.

---

## Socket.IO guest model

Guest Socket.IO connections are allowed.

Protected operations enforce authorization individually.

Do not reject all unauthenticated socket connections globally unless the architecture is deliberately changed.

---

## Database v2

`NanashiCollectibles_v2` is the current canonical schema design.

Backend code has been migrated away from the legacy schema.

Do not restore old table dependencies.

---

## Database execution ownership

Real database execution is controlled by the project owner.

Claude can prepare SQL but must not independently run destructive database operations.

---

## Merchant routes

Merchant routes currently remain intentionally unmounted.

Do not mount them merely because the files exist.

---

## Payments

Payments are currently outside the active development scope unless explicitly requested.

Do not expand payment architecture opportunistically during unrelated work.

---

## `vite.config.js`

The current allowed-host configuration is intentional.

Preserve it.

---

# 54. Current Product Implementation Priority

Tournament is currently the most complete frontend/backend vertical.

Other backend domains are available for future frontend connection.

When beginning a new frontend vertical:

1. inspect the existing backend contract
2. inspect the database model
3. define the frontend information architecture
4. reuse existing layout/design primitives
5. implement loading/error/empty states
6. connect realtime behavior only where justified
7. maintain the design constitution in this document

Do not build frontend pages before understanding the actual backend contract.

---

# 55. Verification Standards

Different validation methods provide different levels of confidence.

## Syntax validation

Example:

```bash
node --check
```

proves syntax correctness only.

## Frontend build

```bash
npm run build
```

proves bundling/build compatibility.

## Lint

```bash
npm run lint
```

proves configured static rules pass.

## Mock QA

Mock-server testing validates behavior against the simulated contract.

## Real integration

Only testing against the actual:

* backend
* database
* environment
* network

validates full integration.

Do not describe one form of validation as another.

---

# 56. CLAUDE.md Maintenance Rules

Read this file before substantial work.

Treat it as the project's current operating contract.

## Priority of truth

When determining current behavior, use:

1. current source code
2. current canonical database schema
3. current architectural decisions in this file
4. maintained project documentation
5. historical documentation
6. legacy files

If the source code and this document disagree:

* inspect the discrepancy
* determine whether the code changed intentionally
* do not blindly modify either side
* update this file when architectural truth has changed

---

# 57. When to Update CLAUDE.md

Update this file when one of these changes:

* architecture
* authentication
* authorization
* database contract
* REST contract
* Socket.IO contract
* major dependency
* project-wide UI system
* design system
* deployment workflow
* security constraints
* major technical debt
* significant product behavior
* canonical development workflow

Do not update it for:

* routine bug fixes
* minor visual tweaks
* ordinary commits
* temporary debugging
* small copy changes
* isolated component changes
* day-to-day work-session notes

Git history is the activity log.

CLAUDE.md is the operating contract.

---

# 58. Change History Policy

Do not turn this file into a chronological development diary.

Only record architecture-level changes when they remain useful to future work.

Historical implementation details should live in:

* Git history
* commit messages
* dedicated project documentation
* changelogs

CLAUDE.md should primarily answer:

```text
What is true now?
How does the system work now?
What must Claude preserve?
What rules govern future changes?
What technical debt is currently known?
```

---

# 59. Final Working Principles

When working in this repository:

## Understand before editing

Inspect the actual implementation first.

## Preserve contracts

Do not accidentally break:

* routes
* database relationships
* API shapes
* Socket.IO events
* authentication
* authorization

## Prefer clarity

Code should be understandable by the next developer.

## Prefer consistency

Reuse established patterns rather than inventing a new approach for every feature.

## Prefer deliberate design

UI decisions must serve:

* user comprehension
* usability
* hierarchy
* brand
* interaction

not visual novelty alone.

## Prefer secure defaults

Never trade identity, authorization, privacy, or data integrity for implementation convenience.

## Prefer scoped changes

Solve the actual problem without unnecessary rewrites.

## Verify appropriately

Use the strongest validation available, and state clearly what has and has not been verified.

---

# 60. Core Rule

The objective is not merely to make NanashiCollectibles:

> function.

The objective is to build a platform that is:

* maintainable
* secure
* scalable
* coherent
* visually intentional
* extensible across future Nanashi businesses
* understandable to future developers
* reliable for users

Every significant implementation decision should move the project toward those qualities.

---

# 61. Live Integration Testing Safety

A reachable local backend must never be assumed to use a disposable local database.

Before performing any REST or Socket.IO operation that can write data, first determine whether the configured environment is explicitly safe for test writes.

Do not reveal credentials.

If the database target cannot be confidently identified as development/test infrastructure, do not issue the write without explicit owner authorization.

This applies to:

* enquiries
* user registration
* tournament registrations
* products
* uploads
* administrative actions
* payments
* any other state-changing endpoint/event

Read-only checks, lint, build, mock testing, and frontend rendering are unaffected.