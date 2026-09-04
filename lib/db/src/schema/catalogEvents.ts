import { createInsertSchema } from "drizzle-zod";
import { boolean, date, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const catalogEventsTable = pgTable("catalog_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  shortDescription: text("short_description").notNull(),
  fullDescription: text("full_description").notNull(),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  timezone: text("timezone").notNull().default("Africa/Maputo"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  imageId: integer("image_id"),
  venue: text("venue").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  mapsUrl: text("maps_url").notNull(),
  externalUrl: text("external_url"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCatalogEventSchema = createInsertSchema(catalogEventsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertCatalogEvent = z.infer<typeof insertCatalogEventSchema>;
export type CatalogEvent = typeof catalogEventsTable.$inferSelect;