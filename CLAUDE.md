# What is this project?

Symlink is a personal context management system — a second brain that stores thoughts, tasks, reminders, notes, blockers, and what the user is doing, and more, then prioritizes and surfaces the right things at the right times. It keep's the users mind free of clutter, eliminates the burder of "remembering things" and tracks the users time to help them analyze how they spend their days. It has a natural language AI interface and supports multi-device sync with offline-first architecture.

The owner is a new grad engineer building this as a long-term personal project (~5-10 hrs/week for a year). They are learning systems architecture through this project. They have no Rust experience and have basic TypeScript and React proficiency. They are comfortable with python. They want modern, fast tooling and are not afraid of complexity if it serves the architecture.

# Architecture Overview

**Event sourcing** is the core pattern. All state changes are stored as immutable events. Current state is derived by replaying events (projections). This enables undo, offline sync, full history, and rebuildable views.

**Offline-first**: Client writes to local SQLite first, then syncs to the server in the background. Input never waits for a network round trip. This is the most important performance requirement. There will be AI powered features, which will require a round trip.

**Sync**: Clients push unsynced events to the server, server merges by HLC timestamp order, broadcasts new events to all clients via WebSocket. Conflict resolution is last-write-wins (LWW) by HLC.

**HLC**: Used for deterministic event ordering across devices with unsynchronized clocks. Every event gets an HLC timestamp. Comparison: wallTime → counter → deviceId.

### Tech Stack

- **Desktop/mobile**: Tauri 2 (Rust backend + React webview)
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Server**: Bun + Hono
- **Client DB**: SQLite, managed natively by Rust (inside Tauri)
- **Server DB**: PostgreSQL
- **ORM**: Drizzle ORM. On the server, Drizzle connects directly to PostgreSQL. On the client, `drizzle-orm/sqlite-proxy` and custom driver use Drizzle to generate SQL and `@tauri-apps/plugin-sql` to send SQL over IPC to Tauri, where Rust executes against SQLite and returns results. This proxy/driver layer bridges Drizzle in the webview with native Rust database access.
- **Search**: Meilisearch (online), SQLite FTS5 (offline fallback)

### Decision Log

All architectural and design decisions are tracked in [`ai/decision-log.md`](ai/decision-log.md). Permanent invariants extracted from decisions live in `.claude/rules/architecture.md`.

# Important Conventions

This side project serves two purposes:
1. Primarily, it will be a product that the owner will use and depend on daily. It will have real usage. But it will likely only be used by a single person. However, it should still be designed as if it is a real app for countless users. This is because of point 2.
2. Secondarily, this project is a way for the owner to learn new concepts. Desktop and mobile apps, distributed systems, offline first systems, event sourcing, websockets, etc. These are new and useful concepts.

As the project progresses, no doubt the context above will go stale. Whenever you respond, consider if this context must be updated. Treat this file like a living piece of code.