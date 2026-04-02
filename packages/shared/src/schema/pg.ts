import { jsonb, pgTable, text } from "drizzle-orm/pg-core";

export const events = pgTable("events", {
	id: text("id").primaryKey(),
	userId: text("user_id").notNull(),
	hlcTimestamp: text("hlc_timestamp").notNull(),
	type: text("type").notNull(),
	entityId: text("entity_id").notNull(),
	data: jsonb("data").notNull(),
});
