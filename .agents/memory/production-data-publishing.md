---
name: Production data publishing
description: Safeguard live catalog and analytics records when publishing new versions.
---

Normal publishes must preserve the existing production database. After the initial launch, do not choose the publishing option that sets up or replaces production using current development data unless a deliberate, verified restore is being performed.

**Why:** Reinitializing production from an empty development database removed a live image record even though its App Storage object remained intact.

**How to apply:** Before any deliberate development-to-production data copy, compare catalog and analytics counts, preserve newer production-only records, and verify a backup. For routine code publishes, apply schema changes only and leave production data untouched.