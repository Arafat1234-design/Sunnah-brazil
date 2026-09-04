---
name: Events scheduling
description: Date-only event fields and timezone-aware instants used by the Events CMS.
---

Event records should preserve the entered calendar date and wall-clock times separately from computed UTC instants. Treat the event timezone as authoritative when deriving countdown and past/upcoming status; keep date-only values as `YYYY-MM-DD` strings at the API boundary.

**Why:** OpenAPI date coercion can turn a date-only value into a JavaScript `Date`, which changes the displayed calendar day across timezones.

**How to apply:** Use the date-only pattern for calendar dates, compute `startsAt`/`endsAt` from the supplied IANA timezone, and use the stored instants for ordering and automatic past-event handling.

Public event listings should not be served from browser or intermediary caches, and the homepage/list views should refetch after navigation or focus.

**Why:** A stale empty event-list response can hide a newly published event even while its direct detail URL works.

**How to apply:** Keep public event list/detail responses `no-store` and configure the public event queries to refresh on mount and window focus.