# Symlink

Symlink is a context management tool. It is the place you dump anything on your mind, and Symlink makes it instantly searchable, and surfaces the right things at the right times.

I am building this for _myself_. Hence, it will be tailored to exactly how I want it. Since everyone's brain works differently, there is a good chance I am the only person in the world that will find this useful. But that's good enough, since, again, I am building this for myself.

I am drawing inspiration from tools like obsidian, linear, figma, uv, bun, railway, and more. Many of these tools I will be using in this project. I like lightweight, fast, aesthetic, and highly functional software. This project may help me learn how to build such software.

Besides this section, pretty much everything in this README (as well as most of the code) is written by AI. Although though the idea and vision is my own, the AI is just so much better at putting words to them. The same can be said for the code.

## What This Is

Symlink manages the context of your life. You tell it everything — tasks, reminders, blockers, notes, habits — and it holds that information, prioritizes it, and tells you what to focus on right now. When context changes ("I'm unblocked on X"), it recomputes priorities and tells you what shifted.

### Core Use Cases

- **Quick capture**: Hit a keyboard shortcut, type anything, hit enter. Done in under a second. The system stores it and figures out what it means.
- **Priority resolution**: Given everything you've told it, the system maintains a ranked list of what you should be working on. When things change (blocked, unblocked, done, new info), it re-resolves.
- **Context caching**: When you switch tasks, dump what's in your head. When you come back, read the cache instead of rebuilding mental context from scratch.
- **Contextual reminders**: "Remind me to give Sidra her gift next time I see her." Months later, when you mention Sidra, it fires.
- **Natural language interface**: Say "done writing the implementation for the PR" and the system figures out which entity you mean and what to update.
- **AI-assisted planning**: Daily planning, habit tracking, weekly recaps. The AI uses your history to help structure your time.


### Product Requirements


- **Blazingly fast input**: Quick capture must feel instant. No network round trip. This is non-negotiable — if it's slow to add context, the app loses its value.
- **Fast responses**: After input, the system should update and respond quickly. Nice to have, not a dealbreaker.
- **Offline support**: Core functionality (capture, local search, viewing entities) works without internet. AI features require connectivity.
- **Multi-device**: Mac desktop app, web app, Android app. All synced.
- **Searchable**: Cmd+K, type anything, see results as you type (not after hitting enter).
- **Undoable**: Cmd+Z undoes any operation — yours or the AI's.
- **Multi-user ready**: Although this is built for myself, and I expect to be the only user, it will be built to support any number of users.

---

## Architecture

### Event Sourcing

The foundational architectural decision: **store every change as an immutable event, derive current state by replaying events.**

Instead of a `tasks` table with mutable rows, there is an `events` table. Each event records something that happened: an entity was created, a field was updated, context was added, input was received. Current state (what entities exist, their statuses, priorities) is a **projection** — a view computed by folding over events.

Why event sourcing:

| Requirement | How Event Sourcing Helps |
|---|---|
| Undo | Append a "revert" event. Projection skips reverted events. |
| Context history | Every update is already an event. Replay an entity's events to see its full history. |
| Offline + sync | Each device appends events locally, merges when online. No write conflicts. |
| Search indexing | Events are immutable. Index incrementally. |
| Resolver | Pure function that replays events to compute current priorities. |
| Versioned projections | Change how you compute state without migrating data. Just replay events through new logic. |

### Event Structure

```typescript
type Event = {
  id: string                // UUID v7 (time-ordered, globally unique without coordination)
  userId: string            // who created this event
  timestamp: HLCTimestamp   // hybrid logical clock for distributed ordering
  deviceId: string          // which device created it
  type: string              // e.g., "entity.created", "entity.field_updated", "input.raw"
  entityId: string | null   // which entity this relates to (null for global events)
  data: Record<string, any> // payload, varies by event type
  version: number           // schema version of this event type
  syncedAt: string | null   // null = not yet synced to server
  revertedBy: string | null // ID of the reverting event, if undone
}
```

Key design decisions:
- **UUID v7** for IDs: time-ordered and globally unique. Two offline devices can generate IDs without colliding. Lexicographic sort approximates chronological order.
- **HLC timestamps** for ordering: combines wall clock time with a logical counter and device ID. Gives deterministic total ordering across devices even when clocks disagree. See the HLC section below.
- **`type` as string** (not enum): new event types can be introduced without schema changes.
- **`data` as flexible JSON**: each event type defines its own payload shape. The `version` field allows evolving payload schemas over time.
- **`syncedAt`**: how the client tracks what needs to be pushed to the server.
- **`revertedBy`**: undo creates a new event and marks the original. Append-only log is preserved.

### Hybrid Logical Clocks (HLC)

HLCs solve the problem of ordering events across multiple devices whose wall clocks may disagree.

```typescript
type HLCTimestamp = {
  wallTime: number   // milliseconds since epoch
  counter: number    // logical counter, increments on each event
  deviceId: string   // tie-breaker for simultaneous events
}
```

Comparison: first by `wallTime`, then `counter`, then `deviceId` (lexicographic). This produces a deterministic total order. Every device that sees the same set of events will sort them identically.

On event creation: `HLC = max(local_wall_clock, last_HLC.wallTime)` + increment counter. On receiving a remote event: `HLC = max(local_wall_clock, remote_HLC.wallTime, local_HLC.wallTime)` + increment. This ensures HLCs are monotonically increasing and converge across devices.

A library like `hybrid-logical-clock` (npm) handles the algorithm. The integration work is making sure every event creation and every sync exchange goes through the HLC.

### Offline-First Design

The local database is the primary database for each client. The server is just another participant that never goes offline.

```
User input
    │
    ▼
Local SQLite ← write here FIRST, always, even when online
    │
    │ (background sync when connected)
    ▼
Server (Postgres)
```

This is why input is instant: it never waits for a network round trip. SQLite writes take microseconds. The UI updates from local state immediately. Sync happens in the background.

When offline, events accumulate locally with `syncedAt = null`. When connectivity returns, they are pushed to the server and merged.

### Sync Algorithm

```
DEVICE                                     SERVER
  │                                           │
  │  1. Create event locally                  │
  │  2. Write to SQLite (syncedAt = null)     │
  │  3. Update local projections              │
  │  4. UI updates instantly                  │
  │                                           │
  │  ── when online ──                        │
  │                                           │
  │  5. Push unsynced events ──────────────►  │
  │                                           │  6. Validate & insert into Postgres
  │                                           │  7. Update search index
  │                                           │  8. Recompute projections
  │                                           │  9. Check triggers
  │                                           │
  │  10. Receive new events  ◄──────────────  │  (events from other devices,
  │      via WebSocket                        │   AI-generated events, etc.)
  │                                           │
  │  11. Insert into local SQLite             │
  │  12. Update local projections             │
  │  13. Mark pushed events as synced         │
  │  14. UI updates                           │
```

### Conflict Resolution

Strategy: **Last Write Wins (LWW)** based on HLC timestamp. When two devices modify the same entity field while offline, the event with the later HLC wins. This is deterministic — every device computes the same result.

True conflicts (same field, same entity, concurrent offline edits) are rare for a personal tool but the system is designed to handle them correctly regardless of user count.

### The Resolver

A pure function that takes current entity state and outputs a prioritized action list.

```
All entities (current state)
    │
    ▼
┌─────────────┐
│  Resolver   │  Filter done/archived → separate blocked → sort by priority
└──────┬──────┘
       │
       ▼
{ focus: Entity, queue: Entity[], blocked: Entity[] }
```

Runs after every event is processed. On the server (after inserting an event) and on the client (after updating local state). It is fast because it operates on in-memory projected state — just filtering and sorting.

The resolver starts simple (sort by fractional rank, filter by status) and grows over time to consider time-of-day, context ("at work" vs "at home"), energy level, and AI-driven insights.

### Priority Model

Uses **fractional indexing** for relative ordering: inserting between positions 1 and 2 gives rank 1.5. Between 1 and 1.5 gives 1.25. No reindexing needed. This is the same technique used by Figma and Linear for item ordering.

### Projections

Projections are derived views computed from the event log. Examples:
- **Entity state**: fold all events for an entity to get its current title, status, priority, etc.
- **Resolver output**: the prioritized task list.
- **Search index**: the set of documents in Meilisearch.

Projections are disposable and rebuildable. If the resolver logic changes, replay all events through the new logic to get a fresh projection. No data migration needed.

---

## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| Desktop + mobile app | **Tauri 2** | Native performance, Rust backend for SQLite/notifications/hotkeys, webview frontend. ~10x smaller than Electron. Supports Mac, Android. |
| Frontend | **React + TypeScript** | Shared across Tauri webview, browser, and mobile. Large ecosystem. |
| Styling | **Tailwind CSS + shadcn/ui** | Utility-first CSS + copy-paste component library. Full control, small bundles, great DX. |
| Client-side DB | **SQLite** | Embedded in Tauri via `rusqlite`. On web: WASM via `wa-sqlite` or `sql.js` with OPFS/IndexedDB. Instant writes, offline-first. |
| Server runtime | **Bun** | Fast TypeScript/JavaScript runtime. Faster than Node for most workloads. |
| Server framework | **Hono** | Lightweight, fast web framework. Good WebSocket support. |
| Server DB | **PostgreSQL** | Relational data with JSONB flexibility. Strong consistency. LISTEN/NOTIFY for real-time. Excellent Railway support. |
| Search | **Meilisearch** | Instant search-as-you-type (<50ms), typo-tolerant, easy to self-host. Used when online. |
| Offline search | **SQLite FTS5** | Full-text search built into SQLite. Fallback when Meilisearch is unreachable. |
| Real-time | **WebSockets** | Persistent bidirectional connection. Server pushes events to clients immediately. No polling. |
| AI | **Claude API** | Natural language parsing, trigger evaluation, resolver intelligence, summaries. |
| Auth | **Clerk** | Lightweight, good DX, handles the hard parts (sessions, tokens, OAuth). |
| Linting/formatting | **Biome** | Single tool replacing ESLint + Prettier. Written in Rust, extremely fast. |
| Event ordering | **HLC** (Hybrid Logical Clock) | Deterministic total ordering across devices with unsynchronized clocks. |
| Hosting | **Railway** | Managed Postgres, easy service deployment, good DX, predictable pricing. |

### Why Not X?

- **Electron** over Tauri: 10x larger binaries, much more RAM. Tauri uses the OS webview.
- **Node** over Bun: Bun is faster and has better TypeScript support out of the box.
- **Express** over Hono: Express is dated. Hono is lighter, faster, and designed for modern runtimes.
- **MongoDB** over Postgres: The data is highly relational (entities reference entities, events reference entities). Postgres JSONB gives schema flexibility where needed without giving up relational queries.
- **AWS/Kubernetes** over Railway: Massive operational overhead for a solo project. Railway covers all needs. Can migrate later if needed.
- **Chakra/AntD** over Tailwind+shadcn: Chakra and AntD are dependency-heavy component libraries with opinionated styling that's hard to override. shadcn copies component source into your project — you own and control everything.

---

## Project Structure

```
symlink/
├── apps/
│   ├── desktop/          # Tauri 2 app (Mac + Android)
│   │   ├── src/          # React frontend (shared with web)
│   │   └── src-tauri/    # Rust backend (SQLite, hotkeys, notifications)
│   ├── web/              # Web app (same React code, different entry point)
│   └── server/           # Bun + Hono API server
├── packages/
│   ├── shared/           # Shared TypeScript types, event definitions, HLC
│   ├── sync/             # Sync protocol (push/pull/merge logic)
│   └── resolver/         # Priority resolver (pure function, runs client + server)
├── CLAUDE.md
├── biome.json
├── package.json          # Workspace root
└── README.md
```

Monorepo with shared packages. The `shared` package contains types and logic used by both client and server. The `sync` package contains the sync protocol. The `resolver` runs on both client (for instant local updates) and server (for authoritative state).
