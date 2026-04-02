# Symlink — Agent Context

## What is this project?

Symlink is a personal context management system — a second brain that stores tasks, reminders, notes, blockers, and habits, then prioritizes and surfaces the right things at the right times. It has a natural language AI interface and supports multi-device sync with offline-first architecture.

The owner is a new grad engineer building this as a long-term personal project (~10 hrs/week for a year). They are learning systems architecture through this project. They have no Rust experience and have basic TypeScript and React proficiency. They are comfortable with python. They want modern, fast tooling and are not afraid of complexity if it serves the architecture.

## Architecture Overview

**Event sourcing** is the core pattern. All state changes are stored as immutable events. Current state is derived by replaying events (projections). This enables undo, offline sync, full history, and rebuildable views.

**Offline-first**: Every client writes to local SQLite first, then syncs to the server in the background. Input never waits for a network round trip. This is the most important performance requirement.

**Sync**: Clients push unsynced events to the server, server merges by HLC timestamp order, broadcasts new events to all clients via WebSocket. Conflict resolution is last-write-wins (LWW) by HLC.

**HLC (Hybrid Logical Clock)**: Used for deterministic event ordering across devices with unsynchronized clocks. Every event gets an HLC timestamp. Comparison: wallTime → counter → deviceId.

## Tech Stack

- **Desktop/mobile**: Tauri 2 (Rust backend + React webview)
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Client DB**: SQLite via Tauri SQL plugin, queried through Drizzle `sqlite-proxy`
- **Client ORM**: Drizzle ORM — defines schemas, generates SQL, provides type safety. Uses `sqlite-proxy` driver to route queries through Tauri's SQL plugin over IPC to native rusqlite.
- **Server**: Bun + Hono (TypeScript)
- **Server DB**: PostgreSQL
- **Search**: Meilisearch (online), SQLite FTS5 (offline fallback)
- **Real-time**: WebSockets
- **AI**: Claude API
- **Auth**: Clerk
- **Linting/formatting**: Biome
- **Hosting**: Railway

## Monorepo Structure

```
symlink/
├── apps/
│   ├── desktop/          # Tauri 2 (Mac + Android)        ✅ scaffolded
│   │   ├── src/          # React frontend
│   │   └── src-tauri/    # Rust backend
│   ├── web/              # Web app                        🔲 deferred (decision #3)
│   └── server/           # Bun + Hono API                 🔲 planned
├── packages/
│   ├── shared/           # Shared types, event definitions, HLC  ✅ scaffolded
│   ├── ui/               # Shared React components        ✅ scaffolded
│   ├── sync/             # Sync protocol logic            🔲 planned
│   └── resolver/         # Priority resolver (runs on client + server)  🔲 planned
├── CLAUDE.md
├── biome.json
└── package.json
```

## Decision Log

All architectural and design decisions are tracked in [`ai/decision-log.md`](ai/decision-log.md). **Read this file before making suggestions that could conflict with prior decisions.** Use `/log-decision` to append new decisions.

## Key Design Decisions

- **Event structure**: Every event has an id (UUID v7), userId, HLC timestamp, deviceId, type (string), entityId (nullable), data (JSON), version, syncedAt (null if unsynced), revertedBy (null if not undone).
- **Undo**: Append a compensating event with revertedBy pointing to the original. Projections skip reverted events.
- **Priority**: Fractional indexing for relative ordering (same technique as Figma/Linear). No reindexing when inserting between items.
- **Resolver**: Pure function. Takes all entity states, outputs prioritized list. Runs after every event on both client and server.
- **Data models are intentionally minimal**. Start with the least possible fields and add as use cases demand. Do not speculatively add fields.
- **Meilisearch is deferred**. Search will be integrated later. For now, SQLite FTS5 or basic queries are sufficient.

## Coding Conventions

- **Runtime**: Bun (not Node)
- **Linter/formatter**: Biome (not ESLint/Prettier)
- **Package manager**: pnpm
- **TypeScript**: Strict mode. Use modern, fast tooling even if beta.
- **Keep it simple**: YAGNI. Don't add features, abstractions, or fields that aren't needed yet. Three similar lines > premature abstraction.
- **Events are the source of truth**. Never mutate state directly. Always go through the event pipeline.

# Important Conventions for any agent

This side project serves two purposes:
1. Primarily, it will be product that the owner will use and depend on daily. It will have real usage. But it will likely only be used by a single person. Although it should be designed as if it is a real app for countless users. This is because of point 2
2. Secondarily, this project is a way for the owner to learn new concepts. Desktop and mobile apps, distributed systems, offline first systems, event driven systems, websockets, etc. These are new and useful concepts.

As the project progresses, no doubt the context above will go stale. Whenever you respond, consider if this context must be updated. Treat this file like a living piece of code.

Phase 1 scaffolding is complete. The pnpm monorepo is set up with apps/web (Vite + React), apps/desktop (Tauri 2 + React), packages/shared, and packages/ui. Both apps render a shared `<Greeting>` component. Next step is implementing the core event store in packages/shared.
