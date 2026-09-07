import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService } from "../lib/objectStorage";
import { requireAdmin } from "../lib/adminAuth";
import {
  assertMp4Signature,
  isManagedObjectUrl,
  MAX_DOWNLOAD_BYTES,
  normalizeManagedObjectPath,
  prepareBookContent,
  UnsafeDownloadError,
} from "../lib/downloadSafety";
import {
  CreateCategoryBody,
  CreateCategoryResponse,
  CreateBookBody,
  CreateVideoBody,
  DeleteCategoryParams,
  GetBookDownloadParams,
  GetBookParams,
  GetVideoDownloadParams,
  GetVideoParams,
  ListCategoriesResponse,
  ListBooksQueryParams,
  ListVideosQueryParams,
  UpdateBookBody,
  UpdateBookParams,
  UpdateVideoBody,
  UpdateVideoParams,
} from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  booksTable,
  categoriesTable,
  downloadEventsTable,
  imagesTable,
  videosTable,
} from "@workspace/db";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const DEFAULT_CATEGORIES = [
  "Education",
  "Islam",
];

type LibraryContent = typeof booksTable.$inferSelect | typeof videosTable.$inferSelect;

function contentUrl(value: string | null, req: Request): string | null {
  if (!value) return null;
  if (value.startsWith("/objects/")) return `/api/storage${value}`;
  return value;
}

function toBook(row: typeof booksTable.$inferSelect, req: Request) {
  return {
    ...row,
    coverUrl: contentUrl(row.coverUrl, req),
    fileUrl: contentUrl(row.fileUrl, req),
    createdAt: row.createdAt.toISOString(),
  };
}

function toVideo(row: typeof videosTable.$inferSelect, req: Request) {
  return {
    ...row,
    thumbnailUrl: contentUrl(row.thumbnailUrl, req),
    videoUrl: contentUrl(row.videoUrl, req),
    createdAt: row.createdAt.toISOString(),
  };
}

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function readContent(value: string): Promise<Buffer> {
  const objectPath = normalizeManagedObjectPath(value);
  if (objectPath) {
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of file.createReadStream()) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_DOWNLOAD_BYTES) throw new Error("Download is too large");
      chunks.push(buffer);
    }
    return Buffer.concat(chunks);
  }

  throw new UnsafeDownloadError(
    "Only files stored in the managed library storage can be downloaded",
  );
}

function downloadFilename(title: string, extension: string): string {
  const safeTitle = title.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 100);
  return `${safeTitle || "livro"}.${extension}`;
}

async function ensureSeedData() {
  const [[{ booksTotal }], [{ videosTotal }]] = await Promise.all([
    db.select({ booksTotal: count() }).from(booksTable),
    db.select({ videosTotal: count() }).from(videosTable),
  ]);
  if (Number(booksTotal) + Number(videosTotal) > 0) return;

  await db.insert(categoriesTable).values(DEFAULT_CATEGORIES.map((name) => ({ name }))).onConflictDoNothing();
}

router.get("/library/summary", async (req, res) => {
  await ensureSeedData();
  const [bookCount, videoCount, featuredBooks, featuredVideos, recentBooks, recentVideos] =
    await Promise.all([
      db.select({ value: count() }).from(booksTable),
      db.select({ value: count() }).from(videosTable),
      db.select().from(booksTable).where(eq(booksTable.featured, true)).orderBy(asc(booksTable.id)).limit(4),
      db.select().from(videosTable).where(eq(videosTable.featured, true)).orderBy(asc(videosTable.id)).limit(4),
      db.select().from(booksTable).orderBy(desc(booksTable.createdAt)).limit(3),
      db.select().from(videosTable).orderBy(desc(videosTable.createdAt)).limit(3),
    ]);
  const recentlyAdded: Array<ReturnType<typeof toBook> | ReturnType<typeof toVideo>> = [
    ...recentBooks.map((book) => toBook(book, req)),
    ...recentVideos.map((video) => toVideo(video, req)),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);
  res.json({
    bookCount: Number(bookCount[0]?.value ?? 0),
    videoCount: Number(videoCount[0]?.value ?? 0),
    featuredBooks: featuredBooks.map((book) => toBook(book, req)),
    featuredVideos: featuredVideos.map((video) => toVideo(video, req)),
    recentlyAdded,
  });
});

router.get("/books", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  await ensureSeedData();
  const parsed = ListBooksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid search or category" });
    return;
  }
  const { search, category } = parsed.data;
  const filters = [];
  if (search) filters.push(or(ilike(booksTable.title, `%${search}%`), ilike(booksTable.author, `%${search}%`), ilike(booksTable.description, `%${search}%`)));
  if (category) filters.push(eq(booksTable.category, category));
  const rows = await db.select().from(booksTable).where(filters.length ? and(...filters) : undefined).orderBy(desc(booksTable.createdAt));
  res.json(rows.map((book) => toBook(book, req)));
});

router.get("/books/:id", async (req, res) => {
  await ensureSeedData();
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid book id" });
    return;
  }
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, id));
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  res.json(toBook(book, req));
});

router.get("/books/:id/download", async (req, res) => {
  await ensureSeedData();
  const parsed = GetBookDownloadParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid book id" });
    return;
  }
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, parsed.data.id));
  if (!book?.fileUrl) {
    res.status(404).json({ error: "Download not available" });
    return;
  }
  res.json({ url: `/api/books/${book.id}/download/file` });
});

router.get("/books/:id/read/file", async (req, res) => {
  await ensureSeedData();
  const parsed = GetBookDownloadParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid book id" });
    return;
  }
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, parsed.data.id));
  if (!book?.fileUrl) {
    res.status(404).json({ error: "Reading file not available" });
    return;
  }

  try {
    const source = await readContent(book.fileUrl);
    const prepared = await prepareBookContent(book.fileType, source);
    res.setHeader("Content-Type", prepared.contentType);
    res.setHeader("Content-Disposition", `inline; filename="${downloadFilename(book.title, prepared.extension)}"`);
    res.setHeader("Content-Length", prepared.output.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox");
    res.setHeader("X-Download-Options", "noopen");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.end(prepared.output);
  } catch (error) {
    if (error instanceof UnsafeDownloadError) {
      req.log.warn({ bookId: book.id, reason: error.message }, "Blocked unsafe book reader file");
      res.status(422).json({ error: "The book file did not pass the security check" });
      return;
    }
    req.log.error({ err: error, bookId: book.id }, "Error preparing book reader file");
    res.status(502).json({ error: "Could not prepare the book for reading" });
  }
});

router.get("/books/:id/download/file", async (req, res) => {
  await ensureSeedData();
  const parsed = GetBookDownloadParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid book id" });
    return;
  }
  const [book] = await db.select().from(booksTable).where(eq(booksTable.id, parsed.data.id));
  if (!book?.fileUrl) {
    res.status(404).json({ error: "Download not available" });
    return;
  }

  try {
    const source = await readContent(book.fileUrl);
    const prepared = await prepareBookContent(book.fileType, source);
    await db.update(booksTable).set({ downloadCount: sql`${booksTable.downloadCount} + 1` }).where(eq(booksTable.id, book.id));
    await db.insert(downloadEventsTable).values({ contentType: "book", contentId: book.id });
    res.setHeader("Content-Type", prepared.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${downloadFilename(book.title, prepared.extension)}"`);
    res.setHeader("Content-Length", prepared.output.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox");
    res.setHeader("X-Download-Options", "noopen");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.end(prepared.output);
  } catch (error) {
    if (error instanceof UnsafeDownloadError) {
      req.log.warn({ bookId: book.id, reason: error.message }, "Blocked unsafe book download");
      res.status(422).json({ error: "The book file did not pass the security check" });
      return;
    }
    req.log.error({ err: error, bookId: book.id }, "Error preparing book download");
    res.status(502).json({ error: "Could not prepare the book download" });
  }
});

router.post("/books", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = CreateBookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid book details" });
    return;
  }
  if (parsed.data.fileUrl && !isManagedObjectUrl(parsed.data.fileUrl)) {
    res.status(400).json({ error: "Book files must use managed storage" });
    return;
  }
  const [book] = await db.insert(booksTable).values(parsed.data).returning();
  res.status(201).json(toBook(book, req));
});

router.patch("/books/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const params = UpdateBookParams.safeParse(req.params);
  const body = UpdateBookBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid book details" });
    return;
  }
  if (body.data.fileUrl && !isManagedObjectUrl(body.data.fileUrl)) {
    res.status(400).json({ error: "Book files must use managed storage" });
    return;
  }
  const [book] = await db.update(booksTable).set(body.data).where(eq(booksTable.id, params.data.id)).returning();
  if (!book) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  res.json(toBook(book, req));
});

router.delete("/books/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const params = GetBookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid book id" });
    return;
  }
  const deleted = await db.delete(booksTable).where(eq(booksTable.id, params.data.id)).returning({ id: booksTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Book not found" });
    return;
  }
  res.status(204).send();
});

router.get("/videos", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  await ensureSeedData();
  const parsed = ListVideosQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid search or category" });
    return;
  }
  const { search, category } = parsed.data;
  const filters = [];
  if (search) filters.push(or(ilike(videosTable.title, `%${search}%`), ilike(videosTable.description, `%${search}%`)));
  if (category) filters.push(eq(videosTable.category, category));
  const rows = await db.select().from(videosTable).where(filters.length ? and(...filters) : undefined).orderBy(desc(videosTable.createdAt));
  res.json(rows.map((video) => toVideo(video, req)));
});

router.get("/videos/:id", async (req, res) => {
  await ensureSeedData();
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid video id" });
    return;
  }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  await db.update(videosTable).set({ viewCount: sql`${videosTable.viewCount} + 1` }).where(eq(videosTable.id, id));
  res.json(toVideo(video, req));
});

router.get("/videos/:id/download", async (req, res) => {
  await ensureSeedData();
  const parsed = GetVideoDownloadParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid video id" });
    return;
  }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, parsed.data.id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  if (!video.downloadEnabled || !video.videoUrl) {
    res.status(403).json({ error: "Downloads are disabled" });
    return;
  }
  res.json({ url: `/api/videos/${video.id}/download/file` });
});

router.get("/videos/:id/download/file", async (req, res) => {
  await ensureSeedData();
  const parsed = GetVideoDownloadParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid video id" });
    return;
  }
  const [video] = await db.select().from(videosTable).where(eq(videosTable.id, parsed.data.id));
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  if (!video.downloadEnabled || !video.videoUrl) {
    res.status(403).json({ error: "Downloads are disabled" });
    return;
  }

  try {
    const mp4 = await readContent(video.videoUrl);
    assertMp4Signature(mp4);
    await db.update(videosTable).set({ downloadCount: sql`${videosTable.downloadCount} + 1` }).where(eq(videosTable.id, video.id));
    await db.insert(downloadEventsTable).values({ contentType: "video", contentId: video.id });
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="${downloadFilename(video.title, "mp4")}"`);
    res.setHeader("Content-Length", mp4.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox");
    res.setHeader("X-Download-Options", "noopen");
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.end(mp4);
  } catch (error) {
    if (error instanceof UnsafeDownloadError) {
      req.log.warn({ videoId: video.id, reason: error.message }, "Blocked unsafe video download");
      res.status(422).json({ error: "The video file did not pass the security check" });
      return;
    }
    req.log.error({ err: error, videoId: video.id }, "Error preparing video download");
    res.status(502).json({ error: "Could not prepare the MP4 download" });
  }
});

router.post("/videos", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = CreateVideoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid video details" });
    return;
  }
  if (parsed.data.videoUrl && !isManagedObjectUrl(parsed.data.videoUrl)) {
    res.status(400).json({ error: "Video files must use managed storage" });
    return;
  }
  const [video] = await db.insert(videosTable).values(parsed.data).returning();
  res.status(201).json(toVideo(video, req));
});

router.patch("/videos/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const params = UpdateVideoParams.safeParse(req.params);
  const body = UpdateVideoBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid video details" });
    return;
  }
  if (body.data.videoUrl && !isManagedObjectUrl(body.data.videoUrl)) {
    res.status(400).json({ error: "Video files must use managed storage" });
    return;
  }
  const [video] = await db.update(videosTable).set(body.data).where(eq(videosTable.id, params.data.id)).returning();
  if (!video) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  res.json(toVideo(video, req));
});

router.delete("/videos/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const params = GetVideoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid video id" });
    return;
  }
  const deleted = await db.delete(videosTable).where(eq(videosTable.id, params.data.id)).returning({ id: videosTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Video not found" });
    return;
  }
  res.status(204).send();
});

router.get("/categories", async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  await ensureSeedData();
  const [books, videos, images, categories] = await Promise.all([
    db.select({ name: booksTable.category, value: count() }).from(booksTable).groupBy(booksTable.category),
    db.select({ name: videosTable.category, value: count() }).from(videosTable).groupBy(videosTable.category),
    db.select({ name: imagesTable.category, value: count() }).from(imagesTable).groupBy(imagesTable.category),
    db.select().from(categoriesTable).orderBy(asc(categoriesTable.id)),
  ]);
  const counts = new Map<string, { bookCount: number; videoCount: number; imageCount: number }>();
  for (const category of categories) counts.set(category.name, { bookCount: 0, videoCount: 0, imageCount: 0 });
  for (const item of books) counts.set(item.name, { ...(counts.get(item.name) || { bookCount: 0, videoCount: 0, imageCount: 0 }), bookCount: Number(item.value) });
  for (const item of videos) counts.set(item.name, { ...(counts.get(item.name) || { bookCount: 0, videoCount: 0, imageCount: 0 }), videoCount: Number(item.value) });
  for (const item of images) counts.set(item.name, { ...(counts.get(item.name) || { bookCount: 0, videoCount: 0, imageCount: 0 }), imageCount: Number(item.value) });
  const response = categories.map(category => ({ id: category.id, name: category.name, ...(counts.get(category.name) || { bookCount: 0, videoCount: 0, imageCount: 0 }) }));
  res.json(ListCategoriesResponse.parse(response));
});

router.post("/categories", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Category name is required" });
    return;
  }

  const [existing] = await db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.name, name));
  if (existing) {
    res.status(409).json({ error: "A category with this name already exists" });
    return;
  }

  const [category] = await db.insert(categoriesTable).values({ name }).returning();
  res.status(201).json(CreateCategoryResponse.parse({ id: category.id, name: category.name, bookCount: 0, videoCount: 0, imageCount: 0 }));
});

router.delete("/categories/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const params = DeleteCategoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, params.data.id));
  if (!category) {
    res.status(404).json({ error: "Category not found" });
    return;
  }

  const [bookUsage, videoUsage, imageUsage] = await Promise.all([
    db.select({ value: count() }).from(booksTable).where(eq(booksTable.category, category.name)),
    db.select({ value: count() }).from(videosTable).where(eq(videosTable.category, category.name)),
    db.select({ value: count() }).from(imagesTable).where(eq(imagesTable.category, category.name)),
  ]);
  if (Number(bookUsage[0]?.value ?? 0) + Number(videoUsage[0]?.value ?? 0) + Number(imageUsage[0]?.value ?? 0) > 0) {
    res.status(409).json({ error: "Move or remove the books, videos, and images in this category before deleting it" });
    return;
  }

  await db.delete(categoriesTable).where(eq(categoriesTable.id, category.id));
  res.status(204).send();
});

router.get("/admin/stats", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  await ensureSeedData();
  const [bookCount, videoCount, downloads, views] = await Promise.all([
    db.select({ value: count() }).from(booksTable),
    db.select({ value: count() }).from(videosTable),
    db.select({ value: sql<number>`coalesce(sum(${booksTable.downloadCount}), 0)` }).from(booksTable),
    db.select({ value: sql<number>`coalesce(sum(${videosTable.viewCount}), 0)` }).from(videosTable),
  ]);
  const categories = await db.select({ id: categoriesTable.id, name: categoriesTable.name, bookCount: sql<number>`(select count(*) from books where category = ${categoriesTable.name})`, videoCount: sql<number>`(select count(*) from videos where category = ${categoriesTable.name})`, imageCount: sql<number>`(select count(*) from images where category = ${categoriesTable.name})` }).from(categoriesTable).orderBy(asc(categoriesTable.id));
  res.json({
    bookCount: Number(bookCount[0]?.value ?? 0),
    videoCount: Number(videoCount[0]?.value ?? 0),
    totalDownloads: Number(downloads[0]?.value ?? 0),
    totalViews: Number(views[0]?.value ?? 0),
    categoryBreakdown: categories.map((category) => ({ id: category.id, name: category.name, bookCount: Number(category.bookCount), videoCount: Number(category.videoCount), imageCount: Number(category.imageCount) })),
  });
});

export default router;