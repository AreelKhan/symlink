import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	hlcTimestamp: text("hlc_timestamp").notNull(),
	type: text("type").notNull(),
	entityId: text("entity_id").notNull(),
	data: text("data", { mode: "json" }).notNull(),
});
