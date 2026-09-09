import { createInsertSchema } from "drizzle-zod";
import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const contactMessagesTable = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  topic: text("topic").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContactMessageSchema = createInsertSchema(contactMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type ContactMessage = typeof contactMessagesTable.$inferSelect;