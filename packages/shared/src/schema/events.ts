import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable(
	"events",
	{
		id: text("id").primaryKey(),
		hlc: text("hlc").notNull(),
		type: text("type").notNull(),
		entityId: text("entity_id"),
		data: text("data", { mode: "json" }).notNull(),
		syncedAt: text("synced_at"),
	},
	(table) => [
		index("idx_events_entity_hlc").on(table.entityId, table.hlc),
		index("idx_events_type_hlc").on(table.type, table.hlc),
		index("idx_events_unsynced").on(table.syncedAt),
	],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
