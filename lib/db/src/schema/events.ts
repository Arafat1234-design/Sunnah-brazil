import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const downloadEventsTable = pgTable("download_events", {
  id: serial("id").primaryKey(),
  contentType: text("content_type").notNull(),
  contentId: integer("content_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});