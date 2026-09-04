import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const analyticsEventsTable = pgTable("analytics_events", {
  id: serial("id").primaryKey(),
  sessionHash: text("session_hash").notNull(),
  eventType: text("event_type").notNull().default("pageview"),
  path: text("path").notNull(),
  title: text("title"),
  device: text("device").notNull().default("desktop"),
  source: text("source").notNull().default("direct"),
  country: text("country"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdAtIdx: index("analytics_events_created_at_idx").on(table.createdAt),
  sessionHashIdx: index("analytics_events_session_hash_idx").on(table.sessionHash),
  pathIdx: index("analytics_events_path_idx").on(table.path),
}));

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEventsTable).omit({ id: true, createdAt: true });
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEventsTable.$inferSelect;