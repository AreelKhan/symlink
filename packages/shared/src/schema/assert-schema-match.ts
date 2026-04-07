/**
 * Compile-time assertion that SQLite and Postgres event schemas produce
 * identical TypeScript types. If the schemas diverge, this file will
 * fail to compile.
 *
 * Run via: tsc --noEmit (also runs in pre-commit hook)
 */
import type { InferSelectModel } from "drizzle-orm";
import type { events as sqliteEvents } from "./events.js";
import type { events as pgEvents } from "./events.pg.js";

type SqliteEvent = InferSelectModel<typeof sqliteEvents>;
type PgEvent = InferSelectModel<typeof pgEvents>;

// Bidirectional assignability check — fails if any field differs
export type _AssertSqliteToPg = SqliteEvent extends PgEvent ? true : never;
export type _AssertPgToSqlite = PgEvent extends SqliteEvent ? true : never;

// Runtime-unused constants to force the compiler to evaluate the types
const _a: _AssertSqliteToPg = true;
const _b: _AssertPgToSqlite = true;
void _a;
void _b;
