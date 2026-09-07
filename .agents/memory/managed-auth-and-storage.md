---
name: Managed authentication and storage
description: OpenShelf relies on Replit-managed Clerk and App Storage rather than custom credentials or repository media files.
---

OpenShelf should keep identity in Replit-managed Clerk and uploaded media in Replit App Storage; PostgreSQL stores catalog metadata, counters, and the admin allowlist relationship.

**Why:** This keeps credentials and large media outside the repository while giving the public catalog and protected catalog desk clear server-side boundaries.

**How to apply:** Preserve the Clerk proxy before body parsing, require a verified Clerk session for mutations, and use the storage URL flow for future media uploads.

Public book and video delivery must remain fail-closed: resolve only managed-storage paths, validate the file signature, and sanitize PDFs before serving them. Upload URL creation is an Admin-only operation.

**Why:** Antivirus warnings and remotely hosted file URLs create a user-safety and SSRF boundary that ordinary MIME checks do not cover.

**How to apply:** Keep download responses attachment-safe (`nosniff`, sandbox CSP, no-store), reject invalid or remote sources, and never increment download counters when validation fails.