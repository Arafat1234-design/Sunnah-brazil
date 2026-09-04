import { createHash } from "node:crypto";
import { and, asc, count, desc, eq, gte, lt, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { TrackAnalyticsEventBody } from "@workspace/api-zod";
import { db } from "@workspace/db";
import {
  analyticsEventsTable,
  booksTable,
  downloadEventsTable,
  imagesTable,
  videosTable,
} from "@workspace/db";
import { requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();
const PERIODS = ["today", "7d", "30d", "90d", "12m", "custom"] as const;
type PeriodKey = typeof PERIODS[number];

function normalizePath(value: string): string {
  const path = value.split("?")[0].trim();
  return path.startsWith("/") ? path.slice(0, 240) : `/${path.slice(0, 239)}`;
}

function classifyDevice(userAgent: string): string {
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return "Tablet";
  if (/mobile|android|iphone|ipod/i.test(userAgent)) return "Telemóvel";
  return "Computador";
}

function classifySource(referrer: string): string {
  if (!referrer) return "Direto";
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    if (/google|bing|yahoo|duckduckgo|baidu/.test(host)) return "Pesquisa";
    if (/facebook|instagram|youtube|tiktok|linkedin|twitter|x\\.com/.test(host)) return "Redes sociais";
    return "Referência";
  } catch {
    return "Referência";
  }
}

function hashVisitorId(visitorId: string): string {
  const monthSalt = new Date().toISOString().slice(0, 7);
  return createHash("sha256").update(`${monthSalt}:${visitorId}`).digest("hex");
}

function headerValue(req: Request, names: string[]): string {
  for (const name of names) {
    const value = req.header(name);
    if (value) return value.split(",")[0].trim().slice(0, 80);
  }
  return "";
}

function asDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function periodWindow(req: Request): { key: PeriodKey; start: Date; end: Date } {
  const rawPeriod = typeof req.query.period === "string" ? req.query.period : "7d";
  const key = (PERIODS.includes(rawPeriod as PeriodKey) ? rawPeriod : "7d") as PeriodKey;
  const now = new Date();
  const customStart = asDate(req.query.start);
  const customEnd = asDate(req.query.end);
  if (key === "custom" && customStart && customEnd && customEnd > customStart) {
    const end = new Date(customEnd);
    end.setUTCDate(end.getUTCDate() + 1);
    const maxStart = new Date(end);
    maxStart.setUTCDate(maxStart.getUTCDate() - 365);
    return { key, start: customStart < maxStart ? maxStart : customStart, end };
  }
  const start = new Date(now);
  if (key === "today") start.setUTCHours(0, 0, 0, 0);
  else if (key === "7d") start.setUTCDate(start.getUTCDate() - 7);
  else if (key === "30d") start.setUTCDate(start.getUTCDate() - 30);
  else if (key === "90d") start.setUTCDate(start.getUTCDate() - 90);
  else start.setUTCDate(start.getUTCDate() - 365);
  return { key, start, end: now };
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

router.post("/analytics/events", async (req, res) => {
  const parsed = TrackAnalyticsEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid analytics event" });
    return;
  }
  const event = parsed.data;
  await db.insert(analyticsEventsTable).values({
    sessionHash: hashVisitorId(event.visitorId),
    eventType: event.eventType,
    path: normalizePath(event.path),
    title: event.title?.trim().slice(0, 160) || null,
    device: classifyDevice(req.get("user-agent") ?? ""),
    source: classifySource(event.referrer ?? req.get("referer") ?? ""),
    country: headerValue(req, ["cf-ipcountry", "x-country", "x-vercel-ip-country"]) || "Desconhecido",
  });
  res.status(202).send();
});

router.get("/admin/analytics", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { key, start, end } = periodWindow(req);
  const windowFilter = and(gte(analyticsEventsTable.createdAt, start), lt(analyticsEventsTable.createdAt, end));
  const pageviewFilter = and(windowFilter, eq(analyticsEventsTable.eventType, "pageview"));
  const [bookCount, videoCount, imageCount, totalDownloads, totalVisitors, totalPageviews, trafficRows, sourceRows, deviceRows, popularRows] = await Promise.all([
    db.select({ value: count() }).from(booksTable),
    db.select({ value: count() }).from(videosTable),
    db.select({ value: count() }).from(imagesTable),
    db.select({ value: sql<number>`coalesce((select sum(${booksTable.downloadCount}) from ${booksTable}), 0) + coalesce((select sum(${videosTable.downloadCount}) from ${videosTable}), 0)` }).from(booksTable),
    db.select({ value: sql<number>`count(distinct ${analyticsEventsTable.sessionHash})` }).from(analyticsEventsTable).where(pageviewFilter),
    db.select({ value: count() }).from(analyticsEventsTable).where(pageviewFilter),
    db.select({
      date: sql<string>`to_char(date_trunc('day', ${analyticsEventsTable.createdAt}), 'YYYY-MM-DD')`,
      visitors: sql<number>`count(distinct ${analyticsEventsTable.sessionHash})`,
      pageviews: count(),
    }).from(analyticsEventsTable).where(pageviewFilter).groupBy(sql`date_trunc('day', ${analyticsEventsTable.createdAt})`).orderBy(asc(sql`date_trunc('day', ${analyticsEventsTable.createdAt})`)),
    db.select({ name: analyticsEventsTable.source, visitors: sql<number>`count(distinct ${analyticsEventsTable.sessionHash})` }).from(analyticsEventsTable).where(pageviewFilter).groupBy(analyticsEventsTable.source).orderBy(desc(sql`count(distinct ${analyticsEventsTable.sessionHash})`)).limit(8),
    db.select({ name: analyticsEventsTable.device, visitors: sql<number>`count(distinct ${analyticsEventsTable.sessionHash})` }).from(analyticsEventsTable).where(pageviewFilter).groupBy(analyticsEventsTable.device).orderBy(desc(sql`count(distinct ${analyticsEventsTable.sessionHash})`)).limit(8),
    db.select({ path: analyticsEventsTable.path, title: analyticsEventsTable.title, views: count() }).from(analyticsEventsTable).where(pageviewFilter).groupBy(analyticsEventsTable.path, analyticsEventsTable.title).orderBy(desc(count())).limit(10),
  ]);

  const liveSince = new Date(Date.now() - 5 * 60 * 1000);
  const liveRows = await db.select({
    sessionHash: analyticsEventsTable.sessionHash,
    path: analyticsEventsTable.path,
    device: analyticsEventsTable.device,
    country: analyticsEventsTable.country,
    createdAt: analyticsEventsTable.createdAt,
  }).from(analyticsEventsTable).where(gte(analyticsEventsTable.createdAt, liveSince)).orderBy(desc(analyticsEventsTable.createdAt)).limit(100);
  const liveVisitors = [...new Map(liveRows.map(row => [row.sessionHash, row])).values()].slice(0, 12);

  const [todayDownloads, weekDownloads, monthDownloads, bookLeaders, videoLeaders, recentBooks, recentVideos, recentImages, recentDownloads] = await Promise.all([
    db.select({ value: count() }).from(downloadEventsTable).where(gte(downloadEventsTable.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000))),
    db.select({ value: count() }).from(downloadEventsTable).where(gte(downloadEventsTable.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))),
    db.select({ value: count() }).from(downloadEventsTable).where(gte(downloadEventsTable.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))),
    db.select({ id: downloadEventsTable.contentId, downloads: count() }).from(downloadEventsTable).where(and(eq(downloadEventsTable.contentType, "book"), gte(downloadEventsTable.createdAt, start))).groupBy(downloadEventsTable.contentId).orderBy(desc(count())).limit(5),
    db.select({ id: downloadEventsTable.contentId, downloads: count() }).from(downloadEventsTable).where(and(eq(downloadEventsTable.contentType, "video"), gte(downloadEventsTable.createdAt, start))).groupBy(downloadEventsTable.contentId).orderBy(desc(count())).limit(5),
    db.select({ title: booksTable.title, createdAt: booksTable.createdAt }).from(booksTable).orderBy(desc(booksTable.createdAt)).limit(5),
    db.select({ title: videosTable.title, createdAt: videosTable.createdAt }).from(videosTable).orderBy(desc(videosTable.createdAt)).limit(5),
    db.select({ title: imagesTable.title, createdAt: imagesTable.createdAt }).from(imagesTable).orderBy(desc(imagesTable.createdAt)).limit(5),
    db.select({ contentType: downloadEventsTable.contentType, contentId: downloadEventsTable.contentId, createdAt: downloadEventsTable.createdAt }).from(downloadEventsTable).orderBy(desc(downloadEventsTable.createdAt)).limit(5),
  ]);

  const [booksForLeaders, videosForLeaders, allBooks, allVideos] = await Promise.all([
    db.select({ id: booksTable.id, title: booksTable.title }).from(booksTable),
    db.select({ id: videosTable.id, title: videosTable.title }).from(videosTable),
    db.select({ id: booksTable.id, title: booksTable.title }).from(booksTable),
    db.select({ id: videosTable.id, title: videosTable.title }).from(videosTable),
  ]);
  const bookTitles = new Map(booksForLeaders.map(item => [item.id, item.title]));
  const videoTitles = new Map(videosForLeaders.map(item => [item.id, item.title]));
  const leaders = bookLeaders
    .map(item => ({ title: bookTitles.get(item.id) ?? "Livro removido", downloads: Number(item.downloads) }))
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 5);

  const recentActivity = [
    ...recentBooks.map(item => ({ type: "Novo livro", title: item.title, createdAt: iso(item.createdAt) })),
    ...recentVideos.map(item => ({ type: "Novo vídeo", title: item.title, createdAt: iso(item.createdAt) })),
    ...recentImages.map(item => ({ type: "Nova imagem", title: item.title, createdAt: iso(item.createdAt) })),
    ...recentDownloads.map(item => ({
      type: "Novo download",
      title: item.contentType === "book" ? (allBooks.find(book => book.id === item.contentId)?.title ?? "Livro removido") : (allVideos.find(video => video.id === item.contentId)?.title ?? "Vídeo removido"),
      createdAt: iso(item.createdAt),
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8);

  const trafficMap = new Map(trafficRows.map(row => [row.date, { visitors: Number(row.visitors), pageviews: Number(row.pageviews) }]));
  const traffic = [];
  for (const cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const date = cursor.toISOString().slice(0, 10);
    traffic.push({ date, ...(trafficMap.get(date) ?? { visitors: 0, pageviews: 0 }) });
  }

  res.json({
    period: { key, start: start.toISOString(), end: end.toISOString() },
    summary: {
      bookCount: Number(bookCount[0]?.value ?? 0),
      videoCount: Number(videoCount[0]?.value ?? 0),
      imageCount: Number(imageCount[0]?.value ?? 0),
      totalDownloads: Number(totalDownloads[0]?.value ?? 0),
      totalVisitors: Number(totalVisitors[0]?.value ?? 0),
      totalPageviews: Number(totalPageviews[0]?.value ?? 0),
    },
    liveVisitors: {
      count: liveVisitors.length,
      visitors: liveVisitors.map(visitor => ({ path: visitor.path, device: visitor.device, country: visitor.country ?? "Desconhecido", lastSeenAt: iso(visitor.createdAt) })),
    },
    traffic,
    downloads: {
      total: Number(totalDownloads[0]?.value ?? 0),
      today: Number(todayDownloads[0]?.value ?? 0),
      week: Number(weekDownloads[0]?.value ?? 0),
      month: Number(monthDownloads[0]?.value ?? 0),
      leaders,
    },
    popularContent: popularRows.map(item => ({ type: item.path.startsWith("/books/") ? "book" : item.path.startsWith("/videos/") ? "video" : item.path.startsWith("/images") ? "image" : "page", title: item.title || item.path, path: item.path, views: Number(item.views) })),
    trafficSources: sourceRows.map(item => ({ name: item.name, visitors: Number(item.visitors) })),
    devices: deviceRows.map(item => ({ name: item.name, visitors: Number(item.visitors) })),
    recentActivity,
  });
});

export default router;