import { asc, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateEventBody,
  DuplicateEventParams,
  GetEventParams,
  ListAdminEventsResponse,
  ListEventsResponse,
  UpdateEventBody,
  UpdateEventParams,
} from "@workspace/api-zod";
import { db, catalogEventsTable, imagesTable } from "@workspace/db";
import { requireAdmin } from "../lib/adminAuth";

const router: IRouter = Router();
const DEFAULT_EVENT_TIMEZONE = "Africa/Maputo";
const DEFAULT_EVENT_DURATION_MS = 2 * 60 * 60 * 1000;

type EventRow = typeof catalogEventsTable.$inferSelect;
type ImageRow = typeof imagesTable.$inferSelect | null;

function imageUrl(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith("/objects/") ? `/api/storage${value}` : value;
}

function eventStatus(event: EventRow, now = new Date()): "draft" | "upcoming" | "past" {
  if (!event.published) return "draft";
  const end = event.endsAt ?? new Date(event.startsAt.getTime() + DEFAULT_EVENT_DURATION_MS);
  return end.getTime() > now.getTime() ? "upcoming" : "past";
}

function formatEvent(event: EventRow, image: ImageRow, now = new Date()) {
  return {
    id: event.id,
    title: event.title,
    shortDescription: event.shortDescription,
    fullDescription: event.fullDescription,
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime,
    timezone: event.timezone,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    imageId: event.imageId,
    imageUrl: imageUrl(image?.imageUrl ?? null),
    venue: event.venue,
    city: event.city,
    address: event.address,
    mapsUrl: event.mapsUrl,
    externalUrl: event.externalUrl,
    published: event.published,
    status: eventStatus(event, now),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function localDateTimeToUtc(dateValue: string, timeValue: string, timezone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}$/.test(timeValue)) {
    throw new Error("Use YYYY-MM-DD and HH:mm for event date and time");
  }
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const base = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  if (!Number.isFinite(base)) throw new Error("Invalid event date or time");

  let guess = base;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).formatToParts(new Date(guess));
      const values = new Map(parts.map((part) => [part.type, part.value]));
      const projected = Date.UTC(
        Number(values.get("year")),
        Number(values.get("month")) - 1,
        Number(values.get("day")),
        Number(values.get("hour")),
        Number(values.get("minute")),
        Number(values.get("second")),
      );
      guess = base - (projected - guess);
    }
  } catch {
    throw new Error("Invalid event timezone");
  }
  const result = new Date(guess);
  if (Number.isNaN(result.getTime())) throw new Error("Invalid event date or time");
  return result;
}

type EventBody = {
  title: string;
  shortDescription: string;
  fullDescription: string;
  eventDate: string | Date;
  startTime: string;
  endTime?: string | null;
  timezone?: string;
  imageId?: number | null;
  venue: string;
  city: string;
  address: string;
  mapsUrl: string;
  externalUrl?: string | null;
  published: boolean;
};

function eventValues(data: EventBody) {
  const timezone = data.timezone || DEFAULT_EVENT_TIMEZONE;
  const eventDate = typeof data.eventDate === "string" ? data.eventDate : data.eventDate.toISOString().slice(0, 10);
  const startsAt = localDateTimeToUtc(eventDate, data.startTime, timezone);
  const endsAt = data.endTime ? localDateTimeToUtc(eventDate, data.endTime, timezone) : null;
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("End time must be later than start time");
  }
  return {
    title: data.title,
    shortDescription: data.shortDescription,
    fullDescription: data.fullDescription,
    eventDate,
    startTime: data.startTime,
    endTime: data.endTime || null,
    timezone,
    startsAt,
    endsAt,
    imageId: data.imageId ?? null,
    venue: data.venue,
    city: data.city,
    address: data.address,
    mapsUrl: data.mapsUrl,
    externalUrl: data.externalUrl || null,
    published: data.published,
  };
}

async function getFormattedEvent(id: number, now = new Date()) {
  const [row] = await db
    .select({ event: catalogEventsTable, image: imagesTable })
    .from(catalogEventsTable)
    .leftJoin(imagesTable, eq(catalogEventsTable.imageId, imagesTable.id))
    .where(eq(catalogEventsTable.id, id));
  return row ? formatEvent(row.event, row.image, now) : null;
}

router.get("/events", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ event: catalogEventsTable, image: imagesTable })
    .from(catalogEventsTable)
    .leftJoin(imagesTable, eq(catalogEventsTable.imageId, imagesTable.id))
    .where(eq(catalogEventsTable.published, true))
    .orderBy(asc(catalogEventsTable.startsAt));
  const now = new Date();
  const formatted = rows.map((row) => formatEvent(row.event, row.image, now));
  formatted.sort((a, b) => {
    const aUpcoming = a.status === "upcoming";
    const bUpcoming = b.status === "upcoming";
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    return aUpcoming ? a.startsAt.localeCompare(b.startsAt) : b.startsAt.localeCompare(a.startsAt);
  });
  res.json(ListEventsResponse.parse(formatted));
});

router.get("/events/:id", async (req, res): Promise<void> => {
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }
  const event = await getFormattedEvent(params.data.id);
  if (!event || !event.published) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(event);
});

router.get("/admin/events", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const rows = await db
    .select({ event: catalogEventsTable, image: imagesTable })
    .from(catalogEventsTable)
    .leftJoin(imagesTable, eq(catalogEventsTable.imageId, imagesTable.id))
    .orderBy(desc(catalogEventsTable.startsAt));
  const now = new Date();
  res.json(ListAdminEventsResponse.parse(rows.map((row) => formatEvent(row.event, row.image, now))));
});

router.post("/events", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid event details" });
    return;
  }
  try {
    const [event] = await db.insert(catalogEventsTable).values(eventValues(parsed.data)).returning();
    const formatted = await getFormattedEvent(event.id);
    res.status(201).json(formatted);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid event date or time" });
  }
});

router.patch("/events/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const params = UpdateEventParams.safeParse(req.params);
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Invalid event details" });
    return;
  }
  try {
    const [event] = await db
      .update(catalogEventsTable)
      .set({ ...eventValues(parsed.data), updatedAt: new Date() })
      .where(eq(catalogEventsTable.id, params.data.id))
      .returning();
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json(await getFormattedEvent(event.id));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid event date or time" });
  }
});

router.post("/events/:id/duplicate", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const params = DuplicateEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }
  const [source] = await db.select().from(catalogEventsTable).where(eq(catalogEventsTable.id, params.data.id));
  if (!source) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  const [event] = await db.insert(catalogEventsTable).values({
    title: `${source.title} (cópia)`,
    shortDescription: source.shortDescription,
    fullDescription: source.fullDescription,
    eventDate: source.eventDate,
    startTime: source.startTime,
    endTime: source.endTime,
    timezone: source.timezone,
    startsAt: source.startsAt,
    endsAt: source.endsAt,
    imageId: source.imageId,
    venue: source.venue,
    city: source.city,
    address: source.address,
    mapsUrl: source.mapsUrl,
    externalUrl: source.externalUrl,
    published: false,
  }).returning();
  res.status(201).json(await getFormattedEvent(event.id));
});

router.delete("/events/:id", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const params = GetEventParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid event id" });
    return;
  }
  const deleted = await db.delete(catalogEventsTable).where(eq(catalogEventsTable.id, params.data.id)).returning({ id: catalogEventsTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.status(204).send();
});

export default router;