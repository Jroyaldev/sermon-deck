# SermonFlow 🕊️

A distraction-free, AI-powered sermon-writing application that helps pastors craft biblically sound, compelling messages—faster.

---

## 1. Project Overview & Vision

Pastors spend countless hours researching, structuring, and refining sermons. SermonFlow reduces that friction by combining a clean writing environment with trustworthy AI research tools.  
The MVP delivers all the essentials needed to move a sermon from first idea to pulpit-ready draft while preserving each pastor’s unique voice.

**Core Goals**

* Keep pastors focused on **writing**, not wrangling tools.
* Surface **reliable, well-cited references**—Scripture, commentaries, scholarly articles—exactly when they’re needed.
* Enable **team collaboration** (staff, volunteers, mentors) without clutter.
* Provide a foundation that can scale to full multimedia sermon & presentation workflows.

---

## 2. Key Features & Capabilities

| Area | Capabilities |
|------|--------------|
| **Series Dashboard** | Kanban-style board (Draft → Review → Finalized) for multi-week series management. |
| **Sermon Editor** | Markdown + collapsible hierarchical blocks (Title → Point → Sub-point → Illustration). |
| **Research Sidebar** | RAG-powered panel offering context-aware Scripture, commentary, historical background, and illustrations with proper citations. |
| **Template Library** | Built-in structures (Narrative, Expository, Thematic) + custom templates. |
| **Collaboration** | Real-time co-editing, inline comments, version history. |
| **AI Assistance** | Contextual content suggestions, deep research queries, illustration ideas—grounded in trusted sources. |

---

## 3. Technical Architecture Overview

```
Client Apps (Web, Mobile)
        │
        ▼
Next.js API Routes / React Native ↔ GraphQL/REST
        │
        ▼
Node.js (Express) Service Layer
        │
        ├─ PostgreSQL  ← relational data (users, sermons, series, templates)
        ├─ Vector DB   ← embeddings & semantic search (Weaviate / Qdrant)
        └─ OpenAI GPT  ← LLM generation (via RAG pipeline)
```

* **Frontend:** React + Next.js (SSR for SEO & performance), React Native (or Flutter) for mobile parity.  
* **Backend:** Node.js/Express API, GraphQL gateway planned.  
* **Data:** PostgreSQL for core data, Vector DB for embeddings.  
* **AI:** Retrieval-Augmented Generation—embeds sermon context, retrieves matching docs, generates grounded answers via OpenAI.

---

## 4. Project Structure (monorepo)

```
sermonflow/
├─ apps/
│  ├─ web/            # Next.js frontend
│  └─ mobile/         # React Native / Flutter app
├─ packages/
│  ├─ api/            # Express server (REST/GraphQL)
│  ├─ ai/             # RAG pipeline, OpenAI helpers
│  └─ ui/             # Shared React component library
├─ prisma/            # DB schema & migrations
└─ docs/              # Architecture & ADRs
```

---

## 5. Setup & Installation

1. **Clone**
   ```
   git clone https://github.com/Jroyaldev/sermon-deck.git
   cd sermon-deck
   ```

2. **Environment**
   ```
   cp .env.example .env
   # fill in DATABASE_URL, OPENAI_API_KEY, VECTOR_DB_URL, etc.
   ```

3. **Install deps**
   ```
   pnpm install   # or npm / yarn
   ```

4. **Database**
   ```
   pnpm prisma migrate dev
   ```

5. **Run all apps**
   ```
   pnpm dev       # uses Turborepo to start web, api, mobile (Expo)
   ```

---

## 6. Development Workflow

| Task | Command |
|------|---------|
| Start dev servers | `pnpm dev` |
| Run tests | `pnpm test` |
| Lint & format | `pnpm lint && pnpm format` |
| Generate Prisma client | `pnpm prisma generate` |

**Branching Model**

* `main` – always deployable  
* `feat/*` – feature branches  
* `fix/*` – bugfixes  
* Pull requests require CI to pass (lint, test, type-check).

---

## 7. API Documentation Overview

* **Auth**  
  * `POST /auth/signup` – create account  
  * `POST /auth/login` – JWT issuance
* **Sermons**  
  * `GET /sermons/:id`  
  * `POST /sermons`  
  * `PUT /sermons/:id`  
* **RAG Research**  
  * `POST /research/query` – body: `{ text, contextIds[] }` ⇒ citations + content blocks
* Full Swagger / GraphQL schema lives at `/api/docs` when running locally.

---

## 8. Deployment

| Environment | Tech |
|-------------|------|
| **Web** | Vercel (Next.js auto-deploy) |
| **API** | Fly.io or Render for Node/Express |
| **DB** | Supabase (PostgreSQL) + managed vector DB (Weaviate Cloud/Qdrant Cloud) |
| **Mobile** | Expo EAS for iOS & Android |

CI/CD via GitHub Actions:
* Lint → Test → Build → Deploy *(per app folder)*.

---

## 9. Contributing Guidelines

1. Fork & clone repo.
2. Create a branch: `git checkout -b feat/my-feature`.
3. Follow code style (ESLint + Prettier enforced).
4. Write tests for new logic.
5. Open a pull request—template will prompt for context & screenshots.
6. One reviewer approval minimum.

All contributors must adhere to the [Contributor Covenant](docs/CODE_OF_CONDUCT.md).

---

## 10. Roadmap & Future Enhancements

| Phase | Planned Items |
|-------|---------------|
| **MVP** | Dashboard, Editor, Research Sidebar, Templates, Basic Collaboration, RAG v1 |
| **Phase 2** | Offline mode, Presentation mode export, Calendar & task integrations |
| **Phase 3** | Multilingual support, Voice dictation, Advanced analytics (sermon impact) |
| **Phase 4** | Plagiarism checker, Live preaching teleprompter, Church CMS integrations |

Have an idea? [Open an issue](https://github.com/Jroyaldev/sermon-deck/issues).

---

*Craft your message. Let AI handle the heavy lifting.* 🎤
