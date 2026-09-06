---
name: Clerk branding
description: Rebranding guidance for the managed Clerk sign-in and sign-up screens.
---

Managed Clerk localization can retain the previous application name inside the default `ptBR` sign-in and sign-up subtitles even when the logo and application copy have changed.

**Why:** The auth screen is rendered by Clerk, so the stale name is not visible in the app's own route or copy and can survive a normal visual rebrand.

**How to apply:** When changing the product name, keep the managed Clerk localization but explicitly override `signIn.start.subtitle` and `signUp.start.subtitle`, then verify both auth routes in the preview.