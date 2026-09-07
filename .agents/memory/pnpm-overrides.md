---
name: Cloudflare pnpm lock compatibility
description: Keeping clean Cloudflare pnpm installs independent of Replit-specific workspace overrides
---

The workspace should not define the large Replit-specific platform override map. The application does not require those package-manager exclusions, and removing them prevents Cloudflare's pnpm 10.11.1 frozen install from comparing environment-specific override state against the lockfile.

**Why:** Replit's pnpm environment accepted the serialized override map, but Cloudflare's clean pnpm environment reported `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` for `overrides`. The override map only optimized optional platform packages and was not needed by application code.

**How to apply:** Keep the workspace free of unnecessary `overrides`, regenerate `pnpm-lock.yaml` with pnpm 10.11.1 when dependency metadata changes, and verify frozen install plus the root build in a clean environment before publishing.