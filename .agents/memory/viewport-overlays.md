---
name: Viewport-bound overlays
description: Positioning rule for modals and other overlays that must remain anchored to the visible browser viewport.
---

Viewport-bound overlays should be rendered through a portal attached to `document.body` and use fixed positioning, especially when the application shell has clipping, transforms, or other layout containers.

**Why:** A fixed element nested inside a complex page shell can be affected by an ancestor's containing block or clipping behavior, causing a modal to appear at the document's scrolled position instead of immediately in the viewport.

**How to apply:** Preserve the existing overlay design and content; change only the render location/positioning and retain scroll locking when the overlay must leave the background at its current scroll position.