import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const events = pgTable(
	"events",
	{
		id: text("id").primaryKey(),
		hlc: text("hlc").notNull(),
		type: text("type").notNull(),
		entityId: text("entity_id"),
		data: jsonb("data").notNull(),
		syncedAt: text("synced_at"),
	},
	(table) => [
		index("idx_events_entity_hlc").on(table.entityId, table.hlc),
		index("idx_events_type_hlc").on(table.type, table.hlc),
		index("idx_events_unsynced").on(table.syncedAt),
	],
);
