# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (run concurrently in two terminals)
npm run dev:frontend     # Vite dev server → http://localhost:5173
npm run dev:backend      # ts-node-dev server → http://localhost:8081

# Build
npm run build            # Builds both frontend (Vite) and backend (tsc)

# Seed demo data (requires Firebase emulator running)
npm run seed

# Run a single test
npx ts-node tests/linearTime.test.ts
```

Firebase emulators must be started before the seed script:
```bash
firebase emulators:start
```

Demo accounts (after seeding): `admin@it-dc.cz` (admin), `tomas.kraus@it-dc.cz` (user), `hana.nova@it-dc.cz` (pending approval). Password is in `backend/src/scripts/seed.ts`.

## Architecture

This is a **monorepo** (npm workspaces) with a React SPA frontend and Express backend, both in TypeScript.

### Data flow

1. **Sync**: Admin triggers `POST /sync/manual` (or Cloud Scheduler triggers `/sync/scheduled`). The backend fetches Jira worklogs + Activity Timeline absences, checks per-user-month locks, and batch-writes to `worklogs_raw` and `absences` Firestore collections.
2. **Display**: Frontend hooks use Firestore `onSnapshot` real-time listeners. Raw worklogs are passed through `linearizeMonth()` (in `frontend/src/utils/linearTime.ts`) which maps entries into the 8:00–16:30 workday window and inserts a 12:00–12:30 lunch pause row.
3. **Edits**: User edits write to `worklogs_edited` (soft-delete overlay); originals in `worklogs_raw` are never mutated. All edits are logged to `audit_log`.
4. **Auth**: Firebase Auth issues ID tokens. Frontend passes them as `Authorization: Bearer` headers; backend middleware (`backend/src/middleware/auth.ts`) verifies the token and checks role + status custom claims.

### Firestore collections

| Collection | Writer | Purpose |
|---|---|---|
| `users/{uid}` | frontend + backend | Profile, role (`admin`/`user`), status (`pending`/`active`/`blocked`), preferences |
| `worklogs_raw/{id}` | backend only | Immutable Jira imports |
| `worklogs_edited/{id}` | frontend | User edits overlaid on raw data |
| `manual_worklogs/{id}` | frontend | User-created entries with no Jira counterpart |
| `absences/{id}` | backend only | Vacation/sick/holiday from Activity Timeline |
| `locks/{year-month-accountId}` | frontend | Prevents edits to a finalized month |
| `audit_log/{id}` | frontend | Diff log of every edit |
| `sync_log/{id}` | backend | History of each sync run |

### Role & access model

- Domain restriction: only `@it-dc.cz` and `@it-dc.sk` emails can register (enforced in `firestore.rules`).
- New users land in `pending` status and see an approval-waiting screen until an admin activates them.
- `admin` role: can manage users, trigger sync, view all reports, lock/unlock any month.
- `user` role: views own data, can edit own worklogs in unlocked months, exports own reports.
- Guards are in both Firestore security rules (`firestore.rules`) and `frontend/src/components/common/ProtectedRoute.tsx`.

### Key frontend patterns

- **Auth state**: `AuthContext` (`frontend/src/contexts/AuthContext.tsx`) wraps Firebase Auth and the Firestore user profile in a single React context consumed via `useAuth()`.
- **Real-time data**: Custom hooks (`useWorklogs`, `useUsers`, `useLock`, etc.) each own a Firestore `onSnapshot` subscription. No global state library (no Redux/Zustand).
- **Time linearization**: `linearizeMonth()` in `frontend/src/utils/linearTime.ts` is the core algorithm. Pure function — safe to unit test in isolation.
- **Backend calls**: `frontend/src/services/api.ts` wraps `fetch` with auto-attached Bearer token for all backend endpoints.
- **Translations**: All Czech UI strings are in `frontend/src/i18n/cs.ts`.

### Backend structure

Minimal Express app with three route groups:
- `GET /health`
- `POST /sync/manual` and `POST /sync/scheduled` (in `backend/src/routes/sync.ts`)
- `POST /users`, `DELETE /users/:uid` (in `backend/src/routes/users.ts`)

Service layer: `jiraClient`, `activityTimelineClient`, `worklogService`, `lockService`. When `USE_MOCK_DATA=true` (or Jira credentials are absent), `worklogService` falls back to mock data.

### Environment variables

Frontend (`.env` in `frontend/`): Firebase project config + `VITE_API_BASE_URL`.  
Backend (`.env` in `backend/`): Firebase Admin credentials, Jira URL/credentials, Activity Timeline URL, `USE_MOCK_DATA`.  
See the respective `.env.example` files for the full list.

### Deployment

- Frontend → Firebase Hosting (`firebase.json` rewrites all paths to `index.html`).
- Backend → Google Cloud Run (`backend/Dockerfile`).
- Scheduled sync → Cloud Scheduler calls `/sync/scheduled` with an OIDC token.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
