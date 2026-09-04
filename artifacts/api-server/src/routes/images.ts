import {
  and,
  desc,
  eq,
  ilike,
  or,
} from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import {
  CreateImageBody,
  GetImageParams,
  ListImagesQueryParams,
  RequestImageUploadUrlBody,
  RequestImageUploadUrlResponse,
  UpdateImageBody,
  UpdateImageParams,
} from "@workspace/api-zod";
import { db, imagesTable } from "@workspace/db";
import { requireAdmin } from "../lib/adminAuth";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function contentUrl(value: string, req: Request): string {
  return value.startsWith("/objects/") ? `/api/storage${value}` : value;
}

function toImage(row: typeof imagesTable.$inferSelect, req: Request) {
  return {
    ...row,
    imageUrl: contentUrl(row.imageUrl, req),
    createdAt: row.createdAt.toISOString(),
  };
}

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get("/images", async (req, res) => {
  const parsed = ListImagesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid search or category" });
    return;
  }

  const { search, category } = parsed.data;
  const filters = [];
  if (search) {
    filters.push(or(
      ilike(imagesTable.title, `%${search}%`),
      ilike(imagesTable.description, `%${search}%`),
      ilike(imagesTable.category, `%${search}%`),
    ));
  }
  if (category) filters.push(eq(imagesTable.category, category));

  const rows = await db.select().from(imagesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(imagesTable.createdAt));
  res.json(rows.map((image) => toImage(image, req)));
});

router.post("/images/upload-url", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = RequestImageUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { size, contentType } = parsed.data;
  if (!contentType.startsWith("image/")) {
    res.status(400).json({ error: "Only image files are supported" });
    return;
  }
  if (size > MAX_IMAGE_BYTES) {
    res.status(400).json({ error: "Images must be 10 MB or smaller" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
    res.json(RequestImageUploadUrlResponse.parse({ uploadURL, objectPath }));
  } catch (error) {
    req.log.error({ err: error }, "Error generating image upload URL");
    res.status(500).json({ error: "Failed to generate image upload URL" });
  }
});

router.post("/images", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = CreateImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid image details" });
    return;
  }

  const [image] = await db.insert(imagesTable).values({
    ...parsed.data,
    category: parsed.data.category || "Islam",
    featured: parsed.data.featured ?? false,
  }).returning();
  res.status(201).json(toImage(image, req));
});

router.get("/images/:id", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid image id" });
    return;
  }
  const [image] = await db.select().from(imagesTable).where(eq(imagesTable.id, id));
  if (!image) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.json(toImage(image, req));
});

router.patch("/images/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const params = UpdateImageParams.safeParse(req.params);
  const body = UpdateImageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid image details" });
    return;
  }
  const [image] = await db.update(imagesTable)
    .set({ ...body.data, featured: body.data.featured ?? false })
    .where(eq(imagesTable.id, params.data.id))
    .returning();
  if (!image) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.json(toImage(image, req));
});

router.delete("/images/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const params = GetImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid image id" });
    return;
  }
  const deleted = await db.delete(imagesTable)
    .where(eq(imagesTable.id, params.data.id))
    .returning({ id: imagesTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.status(204).send();
});

export default router;