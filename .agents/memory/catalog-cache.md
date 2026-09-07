---
name: Mutable catalog caching
description: Cache policy for mutable catalog lists and Admin category counts
---

Mutable catalog list endpoints must bypass HTTP caching when their results drive Admin counts or post-mutation views.

**Why:** The preview proxy/browser can reuse a 304-backed response after a delete or move, leaving category counts and visible content inconsistent even when PostgreSQL is already correct.

**How to apply:** Use `Cache-Control: no-store` on mutable books, videos, images, and category list responses, and invalidate the related client queries after successful mutations.