---
name: Category lifecycle
description: Safety rule for creating and removing catalog categories in the Admin workspace
---

Categories may be created by Admin users, but deletion must be rejected while any book or video still references the category.

**Why:** The catalog stores category names as content metadata, so deleting a referenced category would leave orphaned values and make the Admin taxonomy misleading.

**How to apply:** Keep the server-side usage check authoritative even if the Admin UI disables removal for categories with content. Reclassification should happen before deletion.