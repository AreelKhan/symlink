/**
 * Compile-time check that SQLite and Postgres schemas produce the same types.
 * If either schema drifts, this file will fail to compile.
 */
import type { InferSelectModel } from "drizzle-orm";
import type { events as pgEvents } from "./pg.js";
import type { events as sqliteEvents } from "./sqlite.js";

type SqliteEvent = InferSelectModel<typeof sqliteEvents>;
type PgEvent = InferSelectModel<typeof pgEvents>;

// These assignments will fail at compile time if the types diverge.
type _AssertPgMatchesSqlite = PgEvent extends SqliteEvent ? true : never;
type _AssertSqliteMatchesPg = SqliteEvent extends PgEvent ? true : never;

// Force the compiler to evaluate the types (unused types can be skipped).
export const _driftCheck: _AssertPgMatchesSqlite & _AssertSqliteMatchesPg =
	true;
