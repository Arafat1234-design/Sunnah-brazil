import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { UpdateSiteSettingsBody } from "@workspace/api-zod";
import { db, siteSettingsTable } from "@workspace/db";
import { requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();
const DEFAULT_HERO_TITLE = "Conhecimento que transforma vidas.";

async function getOrCreateSiteSettings() {
  const existing = await db.select().from(siteSettingsTable).limit(1);
  if (existing[0]) return existing[0];

  await db.insert(siteSettingsTable)
    .values({ id: 1, heroTitle: DEFAULT_HERO_TITLE })
    .onConflictDoNothing();

  const created = await db.select().from(siteSettingsTable).limit(1);
  if (!created[0]) throw new Error("Site settings could not be initialized");
  return created[0];
}

function toSiteSettings(row: typeof siteSettingsTable.$inferSelect) {
  return { heroTitle: row.heroTitle };
}

router.get("/site-settings", async (_req, res) => {
  try {
    res.json(toSiteSettings(await getOrCreateSiteSettings()));
  } catch (error) {
    res.status(500).json({ error: "Could not load site settings" });
  }
});

router.patch("/site-settings", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const parsed = UpdateSiteSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid site settings" });
    return;
  }

  try {
    const current = await getOrCreateSiteSettings();
    const [updated] = await db.update(siteSettingsTable)
      .set({ heroTitle: parsed.data.heroTitle })
      .where(eq(siteSettingsTable.id, current.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Site settings not found" });
      return;
    }
    res.json(toSiteSettings(updated));
  } catch (error) {
    req.log.error({ err: error }, "Error updating site settings");
    res.status(500).json({ error: "Could not update site settings" });
  }
});

export default router;