---
name: Admin access layers
description: Security model for the Sunnah Brasil private Admin workspace
---

Admin access requires two independent checks: the signed-in Clerk user must be listed in the configured Admin user IDs, and the user must unlock a short-lived HttpOnly session with the Replit Secret-backed Admin password. Private Admin APIs enforce both checks; the frontend gate is not the security boundary.

**Why:** The catalog contains privileged CRUD and analytics operations, so a compromised authorized browser session should not automatically expose the workspace.

**How to apply:** Keep the password in Replit Secrets only. Do not put it in source code, browser storage, analytics payloads, or chat. Preserve the 30-minute server-side session expiry and SameSite cookie behavior when changing the gate.