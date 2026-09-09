import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateContactMessageBody,
  UpdateAdminContactMessageParams,
  ListAdminContactMessagesResponse,
  UpdateAdminContactMessageBody,
} from "@workspace/api-zod";
import { contactMessagesTable, db } from "@workspace/db";
import { requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();

function formatMessage(message: typeof contactMessagesTable.$inferSelect) {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
  };
}

router.post("/contact/messages", async (req, res): Promise<void> => {
  const parsed = CreateContactMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid contact message" });
    return;
  }

  const [message] = await db.insert(contactMessagesTable).values({
    email: parsed.data.email.trim(),
    topic: parsed.data.topic.trim(),
    message: parsed.data.message.trim(),
  }).returning();
  res.status(201).json(formatMessage(message));
});

router.get("/admin/contact/messages", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const messages = await db.select().from(contactMessagesTable).orderBy(desc(contactMessagesTable.createdAt));
  res.json(ListAdminContactMessagesResponse.parse(messages.map(formatMessage)));
});

router.patch("/admin/contact/messages/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const params = UpdateAdminContactMessageParams.safeParse(req.params);
  const body = UpdateAdminContactMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid contact message update" });
    return;
  }

  const [message] = await db.update(contactMessagesTable)
    .set({ read: body.data.read })
    .where(eq(contactMessagesTable.id, params.data.id))
    .returning();
  if (!message) {
    res.status(404).json({ error: "Contact message not found" });
    return;
  }
  res.json(formatMessage(message));
});

export default router;