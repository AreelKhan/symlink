# Architecture Invariants

## Event Store

The event store module (`packages/shared`) is the **sole writer** to the events table. All writes go through `appendEvent()`; reversals go through `markReverted()`. No other module may `db.insert(events)` or `db.update(events)` directly. This enforces append-only immutability at the application layer.

## Event Model — Deferred Fields

The event model is intentionally minimal. The following fields are deferred and do not exist yet:

- **`userId`**: Each user gets a separate SQLite file (`symlink_{userId}.db`), so the DB file itself is the partition. Add only if server-side needs demand it.
- **`deviceId`**: Embedded in the HLC node field. Denormalize into its own column only if direct queries need it.
- **`version`**: Not needed until deployed production schemas require migration.

Do not add these fields preemptively, only when they are needed. YAGNI.

## Event Model — `entityId` Nullability

The `entityId` column is nullable in SQLite, but nullability is enforced in TypeScript via discriminated unions: entity-bound events require a non-null `entityId`; system-level events allow null. The DB does not enforce this — the type system does.

## Event `type` Column

Text, not enum. SQLite has no native enum, and a CHECK constraint would require a migration for every new event type. Type safety comes from TypeScript discriminated unions.

## Data Models

Intentionally minimal. Start with the fewest fields possible; add as real use cases demand. Do not speculatively add fields.
