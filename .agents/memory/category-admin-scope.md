---
name: Category admin scope
description: Scope and rename behavior for the Admin Categories screen
---

The Admin Categories screen is limited to adding, renaming, and deleting categories. Books, videos, and images are managed from their own Admin sections.

**Why:** The category page is intended to manage category records, not act as a second content-management surface.

**How to apply:** When a category is renamed, update the string `category` values on associated books, videos, and images in the same database transaction so public filters and catalog records stay consistent. Deletion must continue to be rejected while references exist.