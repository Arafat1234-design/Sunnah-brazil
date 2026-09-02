# OpenShelf Digital Library

OpenShelf is a mobile-first digital library for discovering, watching, and legally downloading books and independent video.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required managed services: PostgreSQL, Replit-managed Clerk, and Replit App Storage
- Required env: `DATABASE_URL`, Clerk variables, and App Storage variables (provisioned by Replit)
- Set `CLERK_ADMIN_USER_IDS` to a comma-separated list of Clerk user IDs before using the catalog desk

For local Vite builds, provide the workflow values explicitly, for example:
`PORT=18102 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/openshelf run build`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/openshelf` — React/Vite public site, Clerk screens, and protected catalog desk
- `artifacts/api-server` — Express API, Clerk proxy/auth, catalog routes, and App Storage routes
- `lib/db/src/schema` — Drizzle schema for books, videos, categories, admins, and download events
- `lib/api-spec/openapi.yaml` — source of truth for generated API hooks and Zod validation
- `artifacts/openshelf/src/index.css` — shared visual theme and responsive design tokens

## Architecture decisions

- Clerk is the single authentication system; the API enforces admin access using `CLERK_ADMIN_USER_IDS`.
- Uploaded media belongs in Replit App Storage, while searchable metadata and counters live in PostgreSQL.
- Public catalog routes are read-only; create, edit, delete, upload URL, and statistics routes require an authorized Clerk session.
- Seed records use public-domain/openly available examples and are inserted idempotently on first catalog access.

## Product

- Browse and search books and videos, filter by category, and open detail/player pages.
- Download legally available book files and videos when the catalog item permits it.
- Read the content policy, terms, and contact/reporting guidance.
- Authorized staff can review stats and manage book/video metadata from the catalog desk.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The managed Clerk development instance logs a warning in preview; use production Clerk keys/configuration before publishing.
- Keep the API Clerk proxy mounted before body parsers so Clerk session verification works through Replit's proxy.
- Regenerate client/Zod output after changing `lib/api-spec/openapi.yaml`, then rerun `pnpm run typecheck`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
