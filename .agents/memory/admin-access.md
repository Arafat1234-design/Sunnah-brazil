---
name: Admin access layers
description: Security model for the Sunnah Brasil private Admin workspace
---

Admin access uses the Replit Secret-backed password as its only login factor. A successful unlock creates a signed, short-lived HttpOnly session, and private Admin APIs enforce that session server-side; the frontend gate is not the security boundary.

**Why:** The product owner explicitly chose a simple shared-password Admin workflow instead of Clerk account allowlisting.

**How to apply:** Keep the password in Replit Secrets only. Do not put it in source code, browser storage, analytics payloads, or chat. Preserve the 30-minute server-side session expiry and SameSite cookie behavior when changing the gate. Password-only access means anyone who obtains the password can use Admin.

Category creation and deletion are Admin-only operations; deletion must be refused while books or videos still reference the category.

**Why:** Removing a category that is still referenced would silently break catalog organization and public filtering.

**How to apply:** Keep the guard on both API mutations and retain the 409 conflict behavior in the Admin UI.