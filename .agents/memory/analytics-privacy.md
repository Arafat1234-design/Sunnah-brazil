---
name: Anonymous analytics boundary
description: Privacy constraints for the first-party Sunnah Brasil analytics layer
---

The first-party analytics layer must remain anonymous: the browser may send a random visitor identifier, but the server stores only a monthly-salted hash. Persist coarse device and country categories, categorized traffic sources, and public paths; never persist raw IP addresses, names, emails, exact addresses, or raw referrer URLs. Exclude Admin and authentication routes from pageview tracking.

**Why:** The Admin dashboard needs useful aggregate traffic, device, source, live-visitor, and content metrics without turning public browsing into an identity system.

**How to apply:** Keep new event properties aggregate and purpose-specific. If future analytics needs an identifier or user-level behavior, revisit this decision explicitly instead of expanding the event payload by default.