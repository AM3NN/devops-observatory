# DevOps Observatory Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite, Recharts, Framer Motion, TailwindCSS

## Structure

```text
devops-observatory/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── devops-observatory/ # DevOps Observatory React frontend (served at /)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## DevOps Observatory Features

The main application is an Observatoire Centralisé des Services Numériques with:

1. **Dashboard** (`/`) — Real-time KPIs, traffic chart, service health grid, peak load indicator
2. **Logs ELK** (`/logs`) — Centralized log viewer with level/service/keyword filters, pagination
3. **APM & Traces** (`/apm`) — Application Performance Monitoring metrics and distributed traces
4. **Alerts** (`/alerts`) — Alert management with severity/status filters, acknowledge action
5. **SLOs** (`/slo`) — Service Level Objectives with error budget, burn rate, chain of responsibility
6. **Services** (`/services`) — Service registry with health status, metrics

## Database Schema (lib/db/src/schema/observatory.ts)

- `services` — Service registry (8 pre-seeded services)
- `logs` — Centralized log entries (200 pre-seeded)
- `apm_metrics` — APM metrics per service per hour (24h history)
- `traces` — Distributed traces (50 pre-seeded)
- `alerts` — Alert definitions with severity/status
- `slos` — Service Level Objectives with burn rate

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — declarations only; JS bundling via esbuild/vite
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/devops-observatory` (`@devops-observatory/web`)

React + Vite frontend served at `/`. Uses shadcn/ui, Recharts, Framer Motion.

- `pnpm run dev` — run the frontend from the repo root
- `pnpm --filter @devops-observatory/web run build` — production build

### `artifacts/api-server` (`@devops-observatory/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@devops-observatory/api-zod` for validation and `@devops-observatory/db` for persistence. Auto-seeds database on first start.

- Entry: `src/index.ts`
- Routes: services, logs, apm, alerts, slo, dashboard
- `pnpm --filter @devops-observatory/api-server run dev`

### `lib/db` (`@devops-observatory/db`)

Drizzle ORM schema in `src/schema/observatory.ts`.

- `pnpm --filter @devops-observatory/db run push` — push schema to DB

### `lib/api-spec` (`@devops-observatory/api-spec`)

OpenAPI spec in `openapi.yaml`. Run codegen: `pnpm --filter @devops-observatory/api-spec run codegen`

### `lib/api-zod` / `lib/api-client-react`

Generated Zod schemas and React Query hooks from the OpenAPI spec.
