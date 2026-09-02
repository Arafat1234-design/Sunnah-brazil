import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"),
  duration: text("duration").notNull().default("00:00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  downloadEnabled: boolean("download_enabled").notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  downloadCount: integer("download_count").notNull().default(0),
  featured: boolean("featured").notNull().default(false),
});

export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, createdAt: true, viewCount: true, downloadCount: true });
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videosTable.$inferSelect;