# SermonFlow – Architecture Guide

_Last updated: 2025-05-31_

---

## 1. System Overview

SermonFlow is a cross-platform sermon-writing platform for pastors that combines:

* A distraction-free, Markdown-based editor
* A context-aware research sidebar powered by Retrieval-Augmented Generation (RAG)
* Real-time collaboration and commenting
* A Kanban dashboard for series & sermon workflow

The solution is delivered as a **polyglot monorepo** containing multiple deployable apps (web, mobile, API) plus shared libraries (UI, AI, Types, DB).

---

## 2. Monorepo Layout

```
sermonflow/
├─ apps/
│  ├─ web/        → Next.js 14 SSR/CSR hybrid
│  └─ mobile/     → React-Native (Expo) shell
├─ packages/
│  ├─ api/        → Express/GraphQL service
│  ├─ ai/         → RAG helpers, OpenAI client
│  ├─ ui/         → Tailwind + Headless UI component lib
│  ├─ types/      → Shared TypeScript & Zod schemas
│  └─ db/         → Prisma migrations & seeders
├─ prisma/        → Canonical `schema.prisma`
└─ docs/          → ADRs & technical docs
```

`turbo` orchestrates builds/tests; each workspace declares its own `package.json` but inherits root tool-chain (ESLint, Prettier, Husky, Jest, etc.).

---

## 3. Technology Stack & Rationale

| Layer           | Choice                                   | Why |
|-----------------|------------------------------------------|-----|
| Web             | **Next.js 14 (App Router)**              | Server components, SEO, incremental static regeneration |
| Mobile          | **React Native (Expo)**                  | Code-share with React, painless store deployment |
| Backend         | **Node.js + Express + GraphQL**          | Familiar JS stack, good realtime story (Socket.IO) |
| Data            | **PostgreSQL + pgvector extension**      | Strong relational model + native vector search |
| Vector store    | **Weaviate** (dev) / **Qdrant Cloud** (prod)| Tuned for semantic search, horizontal scaling |
| ORM             | **Prisma**                               | Type-safe, migrations, multi-tenant friendly |
| AI              | **OpenAI GPT-4-Turbo** + **text-embedding-3** | Best-in-class reasoning & embeddings |
| Real-time       | **Socket.IO** + **Redis Pub/Sub**        | Binary protocol fallback-free, easy integration |
| Queueing        | **BullMQ**                               | Email & background job scheduling |
| Infra           | **Vercel (web) • Fly.io (API) • Supabase (DB)** | Fast DX + global PoPs |
| Auth            | **JWT** (access/refresh) + BCrypt        | Stateless API, scalable |
| Styling         | **TailwindCSS**                          | Consistent, utility-first |
| State (web)     | **React-Query + Zustand**                | Cache remote data + local editor state |

---

## 4. Database Design

Prisma schema models major domains:

* `User`, `Sermon`, `Series`, `Template`, `Comment`
* Junctions: `SermonCollaborator`, `SeriesCollaborator`
* Hierarchical editor → `SermonBlock` (self-referencing) with versions
* Tags/Categories many-to-many
* AI artifacts → `AIResearchQuery`, `AIResearchCitation`, `EmbeddingVector`

Key design decisions:

* **Soft delete / archive flags** instead of hard deletes
* **Vector column (`vector(1536)`)** stored alongside text for local semantic search fallbacks
* **Version tables** keep immutable snapshots for diff & rollback

---

## 5. API Architecture

* **REST-first** namespace under `/api/v1` (Auth, Sermons, Series, Templates, Research, Collaboration, Files, Search, Notifications).
* **GraphQL gateway** exposed at `/graphql` (optional; powered by Mercurius) for flexible client queries.
* OpenAPI 3 spec auto-generated via Swagger-JSDoc.

Cross-cutting concerns:

* `express-async-errors` for promise handling
* Global `errorHandler` translates exceptions to uniform shape
* `rate-limit` on sensitive routes (login, research)
* Pagination: cursor or page/size param

---

## 6. Front-end Architecture

### Component Rules

* Shared design system in `@sermonflow/ui` (Tailwind + Headless UI).
* Page composition follows **Atomic Design** (atoms/molecules/organisms).
* Each feature owns a **slice** (`/features/[feature]/`) containing hooks, components and API calls.

### State

* **Server state** → React-Query with stale-while-revalidate.
* **Client state** → Zustand stores (editor cursor, sidebar visibility).
* Collab cursors/ops handled by Yjs but abstracted behind `useCollaboration()`.

---

## 7. Real-time Collaboration

1. Client connects via Socket.IO (`/socket.io`) with JWT.
2. `setupCollaborationHandlers` authenticates & joins logical room `sermon:{id}`.
3. Editor uses **Yjs** CRDT; operations broadcast through Socket.IO; Redis adapter ensures multi-node sync.
4. Block-level locks (30 s TTL) stored in Redis to avoid merge hell during large edits.
5. Presence & cursors published every 10 s; last-seen used for statistics.

---

## 8. AI Integration (RAG)

Pipeline (package `@sermonflow/ai`):

1. **Embed** pastor query & sermon context with OpenAI embedding model.
2. **Retrieve**:
   * Local Postgres pgvector (fast, cheap) for recently indexed docs.
   * External Weaviate / Qdrant for larger corpora (commentaries, articles).
3. **Rank & Filter** (semantic score + source reputation whitelist).
4. **Generate** GPT-4 turbo prompt with citations (`[1]`, `[2]`).
5. **Cache** final answer & chunks; store vectors for future hits.

Research Sidebar makes `/research/query` call; suggestions endpoint persists citations on accept.

---

## 9. Auth & RBAC

Flow:

```
POST /auth/login → {JWT, refreshJWT}
   ↓
Authorization: Bearer <JWT>
   ↓ (middleware)
req.user = { id, role }
```

Roles: `ADMIN`, `PASTOR`, `ASSISTANT`, `GUEST`.

* **requireRoles([…])** gate-keeps endpoints.
* Ownership helper `requireOwnerOrAdmin`.
* Refresh token rotation & blacklist stored in Redis.
* Email verification, reset & invite links sent via Nodemailer → BullMQ queue.

---

## 10. Deployment Topology

```
           ┌────────────┐
           │   Vercel   │  (Next.js SSR, static assets)
           └─────┬──────┘
                 ▼
          Cloudflare CDN
                 │
┌───────────────▼─────────────────┐
│           Fly.io app            │
│  - Express API / Socket.IO      │
│  - Sidekiq/BullMQ worker        │
└──────────┬───────────┬──────────┘
           │           │
   Supabase (Postgres) │
                Managed Qdrant
```

* **Zero-downtime** via Fly.io VM‐replacement, sticky sessions not required thanks to Redis adapter.
* GitHub Actions matrix deploys web → Vercel, api → Fly, db migrations → Supabase.

---

## 11. Developer Workflow

1. `pnpm i` – bootstrap workspaces  
2. `cp .env.example .env` – configure secrets  
3. `pnpm prisma migrate dev` – local DB  
4. `pnpm dev` – turbo starts API (3000) + web (3001) + mobile (Expo)  
5. Tests: `pnpm test` (Jest), `pnpm test:e2e` (Playwright forthcoming)

Pre-commit hooks: ESLint + Prettier + type-check.

---

## 12. Performance Considerations

* Next.js **ISR** for public pages, editor remains client-rendered.
* Heavy AI calls debounced; streaming SSE planned for long answers.
* Database indices on `status`, `createdById`, `scheduledDate`.
* Vector searches limited to top-k 15; async refine for “deep research”.

---

## 13. Security Measures

* Helmet CSP, HSTS, Referrer-Policy.
* Passwords hashed with 12-round BCrypt.
* Rate-limit on auth & research.
* Upload validation (Multer + content-type whitelist).
* Secrets managed via Vercel/Fly secrets; never committed.

---

## 14. Scaling Strategies

* **Horizontally scale API** – stateless, Redis adapter keeps sockets in sync.
* **Read replicas** for Postgres; writable leader on Supabase.
* Queue workers auto-scale based on BullMQ backlog.
* Vector DB sharding supported by Qdrant Cloud.
* CDN edge caching for template assets & static markdown renders.

---

## 15. Future Roadmap

| Phase | Highlights |
|-------|------------|
| **MVP (now)** | Series dashboard, block editor, RAG v1, basic collab |
| **Phase 2** | Offline drafts, presentation export, calendar sync |
| **Phase 3** | Voice dictation, multilingual AI, mobile offline |
| **Phase 4** | Teleprompter mode, plagiarism detection, Church CMS integration |
| **Phase 5** | Marketplace for sermon templates & illustrations |

---

### Contributing

Refer to `README.md` for coding standards, branch strategy and pull-request templates. PRs touching architecture must include an updated ADR under `docs/adr/`.

*Craft your message — let AI handle the heavy lifting.* 🕊️
