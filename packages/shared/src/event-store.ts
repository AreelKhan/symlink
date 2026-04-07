import type { SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import type { HlcClock } from "./hlc.js";
import { serializeHlc } from "./hlc.js";
import { events } from "./schema/events.js";
import { uuidv7 } from "./uuidv7.js";

type EventInput = {
	type: string;
	entityId?: string | null;
	data: unknown;
};

/**
 * Append an event to the local event store.
 * This is the ONLY function that should insert into the events table.
 */
export async function appendEvent(
	db: SqliteRemoteDatabase,
	clock: HlcClock,
	input: EventInput,
) {
	const hlc = clock.now();
	const id = uuidv7();

	const row = {
		id,
		hlc: serializeHlc(hlc),
		type: input.type,
		entityId: input.entityId ?? null,
		data: input.data,
		syncedAt: null,
	};

	await db.insert(events).values(row);
	return { id, hlc: row.hlc };
}
