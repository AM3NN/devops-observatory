# DevOps Observatory

Centralized observability platform for monitoring digital services through logs, APM metrics, traces, alerts, SLOs, and service health dashboards.

This repository is a pnpm monorepo built as a final-year engineering project (PFE). It includes a React frontend, an Express API, a PostgreSQL database layer, and shared typed API contracts generated from OpenAPI.

## Overview

DevOps Observatory gives support and platform teams a single place to:

- monitor service health in real time
- inspect centralized logs
- analyze latency, throughput, and error rates
- review distributed traces
- manage alerts
- track SLOs, burn rate, and error budget consumption
- register and observe external services through an ingestion API

## Main Features

- **Dashboard**: global KPIs, traffic trends, service health, active alerts, and SLO risk overview
- **Logs**: centralized log search with service, level, and keyword filters
- **APM & Traces**: response time, throughput, error rate, and distributed trace inspection
- **Alerts**: alert list with severity/status filters and acknowledge action
- **SLOs**: SLO status, burn rate, and error budget tracking
- **Services**: service registry with health, ownership, and runtime metrics
- **Ingestion Agents**: register external agents and send logs, metrics, traces, and heartbeats

## Architecture

The codebase follows a layered full-stack architecture inside a monorepo:

1. **Presentation layer**: React + Vite frontend in `artifacts/devops-observatory`
2. **API layer**: Express 5 backend in `artifacts/api-server`
3. **Shared contract layer**: OpenAPI, generated Zod schemas, and generated React Query hooks in `lib/api-spec`, `lib/api-zod`, and `lib/api-client-react`
4. **Data layer**: PostgreSQL + Drizzle ORM in `lib/db`

For the observability domain itself, the platform is organized around:

- logs
- APM metrics
- traces
- alerts
- SLOs
- service registry

## Repository Structure

```text
devops-observatory/
├── artifacts/
│   ├── api-server/            # Express API server
│   └── devops-observatory/    # React frontend
├── lib/
│   ├── api-client-react/      # Generated React Query client
│   ├── api-spec/              # OpenAPI spec and codegen config
│   ├── api-zod/               # Generated Zod schemas
│   └── db/                    # Drizzle schema and DB connection
├── scripts/                   # Utility scripts
├── WORKSPACE.md               # Internal workspace notes
├── package.json               # Root workspace scripts
└── pnpm-workspace.yaml        # pnpm workspace config
```

## Tech Stack

- **Language**: TypeScript
- **Frontend**: React, Vite, Tailwind CSS, Radix UI, Recharts, Framer Motion, Wouter
- **Backend**: Node.js, Express 5, Pino
- **Database**: PostgreSQL, Drizzle ORM
- **Validation**: Zod
- **API contract/codegen**: OpenAPI, Orval
- **Package manager**: pnpm workspaces

## Runtime Modes

The API currently supports two modes:

- **Live mode**: default mode. Demo generators are disabled and the platform waits for real telemetry to arrive through the ingestion API.
- **Demo mode**: enabled with `OBSERVATORY_DEMO_MODE=true`. The backend generates simulated traffic, alerts, and SLO activity for showcase/demo use.

## Prerequisites

- Node.js `20.19+` recommended
- pnpm
- PostgreSQL

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure the database

The database layer requires `DATABASE_URL`.

PowerShell:

```powershell
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/devops_observatory"
pnpm --filter @devops-observatory/db push
```

### 3. Start the API server

PowerShell:

```powershell
$env:PORT="4000"
$env:DATABASE_URL="postgresql://postgres:postgres@localhost:5432/devops_observatory"
$env:OBSERVATORY_DEMO_MODE="false"
pnpm --filter @devops-observatory/api-server build
node --enable-source-maps "artifacts/api-server/dist/index.mjs"
```

To run with simulated telemetry instead:

```powershell
$env:OBSERVATORY_DEMO_MODE="true"
```

### 4. Start the frontend

The frontend calls `/api`. In local development, the Vite dev server proxies `/api` to `VITE_API_PROXY_TARGET`.

PowerShell:

```powershell
$env:PORT="3000"
$env:BASE_PATH="/"
$env:VITE_API_PROXY_TARGET="http://localhost:4000"
pnpm dev
```

Open:

```text
http://localhost:3000/
```

## Environment Variables

### API server

- `PORT`: API server port
- `DATABASE_URL`: PostgreSQL connection string
- `OBSERVATORY_DEMO_MODE`: `true` to enable simulated traffic, alerts, and SLOs

### Frontend

- `PORT`: Vite dev server port, defaults to `3000`
- `BASE_PATH`: public base path, defaults to `/`
- `VITE_API_PROXY_TARGET`: local API target for `/api` proxying in development, defaults to `http://localhost:4000`

## Workspace Scripts

From the repository root:

- `pnpm dev`: run the frontend dev server
- `pnpm build`: typecheck and build workspace packages
- `pnpm typecheck`: run TypeScript project references across the workspace

Useful package-level commands:

- `pnpm --filter @devops-observatory/db push`
- `pnpm --filter @devops-observatory/api-server build`
- `pnpm --filter @devops-observatory/web build`

## Ingestion API

External services can send telemetry to the platform through `/api/ingest/*`.

Authentication:

- send `X-API-Key`
- create agent-specific keys through `POST /api/ingest/agents`
- a demo key also exists for quick testing: `obs-key-pfe-demo-2024`

### Main endpoints

- `POST /api/ingest/logs`
- `POST /api/ingest/metrics`
- `POST /api/ingest/traces`
- `POST /api/ingest/heartbeat`
- `GET /api/ingest/agents`
- `POST /api/ingest/agents`

### Example: create an ingestion agent

```bash
curl -X POST http://localhost:4000/api/ingest/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "payment-service-agent",
    "description": "Production payment service",
    "host": "payments.internal",
    "language": "Node.js"
  }'
```

### Example: send logs

```bash
curl -X POST http://localhost:4000/api/ingest/logs \
  -H "Content-Type: application/json" \
  -H "X-API-Key: obs-key-pfe-demo-2024" \
  -d '{
    "logs": [
      {
        "service": "payment-service",
        "level": "ERROR",
        "message": "Database connection timeout",
        "environment": "production"
      }
    ]
  }'
```

### Example: send APM metrics

```bash
curl -X POST http://localhost:4000/api/ingest/metrics \
  -H "Content-Type: application/json" \
  -H "X-API-Key: obs-key-pfe-demo-2024" \
  -d '{
    "service": "payment-service",
    "responseTime": 243,
    "throughput": 128,
    "errorRate": 1.2,
    "cpuUsage": 63,
    "memoryUsage": 58,
    "activeConnections": 27,
    "environment": "production"
  }'
```

### Example: send traces

```bash
curl -X POST http://localhost:4000/api/ingest/traces \
  -H "Content-Type: application/json" \
  -H "X-API-Key: obs-key-pfe-demo-2024" \
  -d '{
    "spans": [
      {
        "traceId": "trace-001",
        "spanId": "span-001",
        "service": "payment-service",
        "operation": "POST /api/payments/charge",
        "duration": 187,
        "status": "ok"
      }
    ]
  }'
```

## Current State

Already implemented:

- typed frontend/backend contract
- service registry
- log ingestion and browsing
- APM metric ingestion and charts
- trace ingestion and inspection
- alert and SLO views
- live telemetry mode support
- defensive UI states for loading, empty, error, and crash fallback handling

Planned next steps for a more production-like observability platform:

- persistent SLO definitions managed in the database
- alert escalation workflow
- deeper ELK / Prometheus / Grafana integration
- authentication and RBAC
- periodic reporting and exports

## License

MIT
