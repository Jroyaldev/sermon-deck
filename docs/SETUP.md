# SermonFlow – Local Development Setup Guide

_Last updated: 2025-05-31_

Welcome to the SermonFlow codebase!  
This guide walks you from a blank machine to a **fully-running local environment** (API + Web + Mobile) so you can start shipping features quickly.

---

## 1. Prerequisites & System Requirements

| Requirement | Minimum Version | Notes |
|-------------|-----------------|-------|
| **OS** | macOS 12 / Windows 11 / Ubuntu 22.04 | Any modern 64-bit system works |
| **CPU** | 4 cores | AI embeddings can be CPU-intensive |
| **RAM** | 8 GB (16 GB+ recommended) | Docker & Node stacks love memory |
| **Disk** | 10 GB free | DB, node_modules, Docker layers |
| **Node.js** | **≥ 18.17** (LTS) | Use [nvm](https://github.com/nvm-sh/nvm) |
| **pnpm** | **≥ 8** | `npm i -g pnpm` |
| **Docker** | **≥ 24** (optional) | For containerized stack |
| **PostgreSQL** | **≥ 15** (if not using Docker) | With `pgvector` extension |
| **Redis** | **≥ 7** (optional) | Real-time collab + queues |
| **Git** | **≥ 2.40** | |
| **Expo CLI** | **≥ 7** (optional) | Mobile app testing |

> Windows users: enable **WSL 2** for a smoother Unix-like experience.

---

## 2. Environment Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/Jroyaldev/sermon-deck.git
   cd sermon-deck
   ```

2. **Install workspace dependencies**

   ```bash
   pnpm install
   ```

3. **Create environment file**

   ```bash
   cp .env.example .env
   ```

   Fill in:

   - `DATABASE_URL` / `TEST_DATABASE_URL`
   - `OPENAI_API_KEY`
   - `JWT_SECRET` & `REFRESH_TOKEN_SECRET`
   - (Optional) `REDIS_URL`, `WEAVIATE_URL`, `SMTP_*`

4. **Enable pgvector**

   ```bash
   # psql
   CREATE EXTENSION IF NOT EXISTS "vector";
   ```

   Docker users – the provided image already includes it.

---

## 3. Database Setup & Migrations

### 3.1 Local PostgreSQL

```bash
# start postgres (adjust to your OS)
brew services start postgresql@15      # macOS
sudo service postgresql start          # Linux
```

### 3.2 Run Prisma migrations

```bash
pnpm prisma migrate dev --name init
```

This will:

- Create the **sermonflow** database
- Apply schema from `prisma/schema.prisma`
- Generate the Prisma client

### 3.3 Seed (optional)

```bash
pnpm --filter @sermonflow/api run db:seed
```

---

## 4. API Server Configuration

```bash
pnpm --filter @sermonflow/api dev
```

Runs **Express** with hot-reload (ts-node + nodemon) on **http://localhost:3000**

Important env knobs (see `.env`):

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default 3000) |
| `ENABLE_REALTIME_COLLAB` | Toggle Socket.IO |
| `ENABLE_QUERY_LOGGING` | Verbose Prisma logs |
| `CORS_ORIGIN` | Whitelisted origins for web/mobile |

API docs: `http://localhost:3000/api/docs`

---

## 5. Web Application Setup

```bash
pnpm --filter @sermonflow/web dev
```

Starts **Next.js** on **http://localhost:3001**

During first run, Tailwind, ESLint and type-checking kick in.

> The web app proxies API requests to `NEXT_PUBLIC_API_URL`  
> (defaults to `http://localhost:3000`).

---

## 6. Development Workflow

Typical **turbo** workflow:

```bash
pnpm dev             # Web + API (+ Mobile if Expo installed)
pnpm lint            # ESLint across workspaces
pnpm format          # Prettier write
pnpm test            # Jest unit tests
pnpm type-check      # tsc --noEmit
```

Hot reload is enabled everywhere.  
Commit hooks (Husky) ensure lint & type-check before every commit.

---

## 7. Testing Instructions

| Layer | Command | Framework |
|-------|---------|-----------|
| Unit (API) | `pnpm -F @sermonflow/api test` | Jest + ts-jest |
| Unit (UI)  | `pnpm -F @sermonflow/web test` | React Testing Library |
| Integration | Coming soon | Supertest |
| E2E | `pnpm playwright test` (roadmap) | Playwright |

Tests run against **TEST_DATABASE_URL**; migrations are applied automatically.

---

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Error: invalid input syntax for type vector` | Enable `pgvector` extension |
| `Prisma: P1001` DB connection error | Check `DATABASE_URL`, Postgres running? |
| 404 on `/api/docs` | API not running or wrong port |
| Web app CORS errors | Add `http://localhost:3001` to `CORS_ORIGIN` |
| Socket.IO disconnects | Ensure `REDIS_URL` consistent across API instances |
| `OPENAI_API_KEY` exceeded quota | Switch to dev model or set `AI_*` env limits |

---

## 9. IDE & Tooling Recommendations

| Tool | Why |
|------|-----|
| **VS Code** | Official workspace settings in `.vscode/` |
| Extensions | _Prisma_, _ESLint_, _Tailwind CSS IntelliSense_, _GitLens_, _Tabnine_ |
| **JetBrains WebStorm/IDEA** | Full TypeScript & Prisma support |
| **Insomnia / Postman** | Import OpenAPI spec for API calls |
| **TablePlus / pgAdmin** | Inspect Postgres data |

Pre-configured **EditorConfig** and **Prettier** keep formatting consistent.

---

## 10. Docker Setup (Optional)

Spin up everything with one command:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This starts:

| Service | Port |
|---------|------|
| postgres | 5432 |
| api | 3000 |
| web | 3001 |
| redis | 6379 |
| weaviate | 8080 |

Override envs in `docker/.env.dev`.  
Logs are streamed in colour by Compose.

---

## 11. Deployment Preparation

1. Set `NODE_ENV=production`
2. Run:

   ```bash
   pnpm build          # turbo builds all workspaces
   pnpm --filter @sermonflow/api db:migrate
   pnpm --filter @sermonflow/api start
   pnpm --filter @sermonflow/web start
   ```

3. Verify:

   - API health: `/health`
   - Web build size: `next build --profile`

Artifact locations:

```
packages/api/dist/
apps/web/.next/standalone/
```

Upload them to Fly.io / Vercel as per `docs/ARCHITECTURE.md`.

---

## 12. Contributing Guidelines (Quick Ref)

1. **Fork → Branch**

   ```
   git checkout -b feat/my-awesome-feature
   ```

2. Follow Conventional Commits (`feat: …`, `fix: …`).

3. Include tests & update docs.

4. Run **CI locally**

   ```
   pnpm lint && pnpm test && pnpm type-check
   ```

5. Submit PR → fill template → assign reviewer.

6. One approval + green CI → merge via **Squash & Merge**.

Code of Conduct: see `docs/CODE_OF_CONDUCT.md`.

---

Happy coding & **May your sermons flow!** 🕊️
