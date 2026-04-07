# Symlink

Symlink is my second brain.

Mental clutter slows me down. Keeping my mind clear helps me exist peacefully and efficiently. Working when my mind is cluttered feels like running while holding grocery bags.

Symlink is where I offload all that clutter. Symlink makes it instantly searchable, well-structured, and surfaces the right information at the right time, and helps me understand how I spend my days. I trust that it will store and recall my thoughts the same way my brain would natively.

I am building this for _myself_. Hence, it will be tailored deeply to my brain. Since everyone's brain works differently, there is a good chance I am the only person in the world that will find this useful. And that's good enough, since, again, I am building this for myself.

I am drawing inspiration from tools like obsidian, linear, figma, uv, bun, railway, and more. Many of these tools I will be using in this project. I like lightweight, fast, aesthetic, and highly functional software. This project may help me learn how to build such software.

---

I want Symlink to manage the context of my life. I tell it everything, what I am doing, what I want to get done, something I have to remember later, my tasks, reminders, notes, thoughts, etc. It holds that information. It makes it easy to explore and discover.

The exact features of the app are not yet clear to me. A couple of ambiguous things I want but have not yet clearly defined are poorly described below.

Based on everything I tell it, its able to build a dynamic list of my todos. It tells me what to focus on right now, and what not focus or even think about right now. And when context changes ("I'm unblocked on X"), it recomputes priorities and tells me what shifted. This moves the burden of "remembering all the things to do, and choosing the right one" out of my brain, and into Symlink. Reducing mental clutter.

It also tracks my time. A few years ago, I used a time tracker for 8 months, It helped me understand how many minutes I spent in the gym, walking to class, scrolling through instagram, sleeping, etc. Most of all it helped me identify time I wasted. Not relaxing, not working, not anything meaningful, just time that vanished. The five minutes I spent scrolling after getting home but before getting in the shower, the 15 minutes I spent laying in bed before getting up, the 2 hours I spent "working" where I didn't actually get anything done.

It was an incredible exercise, but using a time tracking app was so tedious. I want to make it as easy as possible. I have identified a few things:

- Time tracking from any device, rather than a single one.
- Time tracking offline.
- Minimal input. Opening an app, clicking a button, choosing a category, describing what I am doing, and pressing play, is _way_ too much friction. I should just be able to say "I'm walking to work now", and the app knows what to do.

The goal with the time tracking portion of Symlink is it will help me do more of what I want to be doing, and less of what I often find myself doing. 

If I can even start by building a system that can capture input from me on what I am doing, what I want to be doing, etc., very naturally in a non-impeding, low-friction way, then the things that I will be able to do with that data are limitless. The things I mentioned above are the ones that I want, but perhaps those needs will expand or shift.

Up until now, every word I wrote myself, but much of what follows was written by AI. Although though the idea and vision is my own, AI is just so much better at putting words to it. The same can be said for the code.


### Product Requirements


- **Blazingly fast input**: Quick capture must feel instant. No network round trip. This is non-negotiable — if it's slow to add context, the app loses its value.
- **Fast responses**: After input, the system should update and respond quickly. Nice to have, not a dealbreaker.
- **Offline support**: Core functionality (capture, local search, viewing entities) works without internet. AI features require connectivity.
- **Multi-device**: Mac desktop app, web app, Android app. All synced.
- **Searchable**: Cmd+K, type anything, see results as you type (not after hitting enter).
- **Undoable**: Cmd+Z undoes any operation — yours or the AI's.
- **Multi-user ready**: Although this is built for myself, and I expect to be the only user, it will be built to support any number of users (within reason).

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

### Core Event Structure

```typescript
type Event = {
  id: string                // UUID v7 (time-ordered, globally unique without coordination)
  userId: string            // who created this event
  timestamp: HLCTimestamp   // hybrid logical clock for distributed ordering
  type: string              // e.g., "entity.created", "entity.field_updated", "input.raw"
  ...                       // other fields
}
```

Key design decisions:
- **UUID v7** for IDs: time-ordered and globally unique. Two offline devices can generate IDs without colliding. Lexicographic sort approximates chronological order.
- **HLC timestamps** for ordering: combines wall clock time with a logical counter and device ID. Gives deterministic total ordering across devices even when clocks disagree. See the HLC section below.
- **`type` as string** (not enum): new event types can be introduced without schema changes.

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


### Conflict Resolution

Strategy: **Last Write Wins (LWW)** based on HLC timestamp. When two devices modify the same entity field while offline, the event with the later HLC wins. This is deterministic — every device computes the same result.

True conflicts (same field, same entity, concurrent offline edits) are rare for a personal tool but the system is designed to handle them nonetheless. Overengineering at its finest :)


## Tech Stack

| Component | Technology | Rationale |
|---|---|---|
| Desktop + mobile app | **Tauri 2** | Native performance, Rust backend for SQLite/notifications/hotkeys, webview frontend. ~10x smaller than Electron. Supports Mac, Android. |
| Frontend | **React + TypeScript** | Shared across Tauri webview, browser, and mobile. Large ecosystem. |
| Styling | **Tailwind CSS + shadcn/ui** | Utility-first CSS + copy-paste component library. Full control, small bundles, great DX. |
| Client-side DB | **SQLite** | Embedded in Tauri via `rusqlite` with custom Drizzle driver. On web: WASM via drizzlw with OPFS/IndexedDB. Instant writes, offline-first. |
| Server runtime | **Bun** | Fast TypeScript/JavaScript runtime. Faster than Node for most workloads. |
| Server framework | **Hono** | Lightweight, fast web framework. Good WebSocket support. |
| Server DB | **PostgreSQL** | Relational data with JSONB flexibility. Strong consistency. LISTEN/NOTIFY for real-time. Excellent Railway support. |
| Search | **Meilisearch** | Instant search-as-you-type (<50ms), typo-tolerant, easy to self-host. Used when online. |
| Offline search | **SQLite FTS5** | Full-text search built into SQLite. Fallback when Meilisearch is unreachable. |
| Real-time | **WebSockets** | Persistent bidirectional connection. Server pushes events to clients immediately. No polling. |
| Auth | **Clerk** | Lightweight, good DX, handles the hard parts (sessions, tokens, OAuth). |
| Linting/formatting | **Biome** | Single tool replacing ESLint + Prettier. Written in Rust, extremely fast. |
| Event ordering | **HLC** (Hybrid Logical Clock) | Deterministic total ordering across devices with unsynchronized clocks. |
| Hosting | **Railway** | Managed Postgres, easy service deployment, good DX, predictable pricing. |

### Why Not X?

- **Electron** over Tauri: No mobile support, 10x larger binaries, much more RAM.
- **Node** over Bun: Bun is faster and has better TypeScript support out of the box.
- **Express** over Hono: Express is dated. Hono is lighter, faster, and designed for modern runtimes.
- **Drizzle** over Prisma. Drizzle separates query building and executing, enabling a custom driver that can hook up with Tauri 2.
- **NoSQL** over Postgres: The data is highly relational (entities reference entities, events reference entities). Postgres JSONB gives schema flexibility where needed without giving up relational queries.
- **AWS/Kubernetes** over Railway: Massive operational overhead for a solo project. Railway covers all needs. Can migrate later if needed.
- **Chakra/AntD** over Tailwind+shadcn: Chakra and AntD are dependency-heavy component libraries with opinionated styling that's hard to override. shadcn copies component source into your project — you own and control everything.
