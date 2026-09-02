import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const booksTable = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  coverUrl: text("cover_url"),
  fileUrl: text("file_url"),
  fileType: text("file_type").notNull().default("PDF"),
  fileSize: integer("file_size").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  downloadCount: integer("download_count").notNull().default(0),
  featured: boolean("featured").notNull().default(false),
});

export const insertBookSchema = createInsertSchema(booksTable).omit({ id: true, createdAt: true, downloadCount: true });
export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof booksTable.$inferSelect;