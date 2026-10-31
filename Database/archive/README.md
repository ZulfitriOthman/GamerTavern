# Archive — superseded schema

**Status: SUPERSEDED / LEGACY / NOT CURRENT DATABASE.**

These three files describe the *original* pre-v2 GamerTavern schema (uppercase table names — `PERSONAL_USER`, `ACCOUNTS`, `PRODUCTS`, `ORDERS`, `TOURNAMENT`, etc.):

- `All.sql` — the original schema SQL
- `All.dbml` — diagram source (dbdiagram.io DBML format)
- `All.dbdiagram` — diagram source (dbdiagram.io native JSON export)

**Confirmed via a live-database audit on 2026-09-14: none of these tables exist in the live GamerTavern database.** This script was either never executed against it, or its tables were dropped before the audit — either way, there is nothing live built on this design, and no backend code references it (see `NanashiCollectibles/CLAUDE.md`).

Kept here only as historical reference for understanding how the project's data model evolved. **Do not** run `All.sql` against a database that also needs the current schema, and do not use it to create a new database — use `Database/All.sql` (the current schema) instead.
