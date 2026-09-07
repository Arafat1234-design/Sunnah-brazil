---
name: Artifact workflow restarts
description: Environment-specific guidance for stale processes and port collisions in managed artifact workflows.
---

When an artifact workflow restart reports `EADDRINUSE`, first inspect the managed ports and existing artifact processes before changing application code. Old Vite/API processes can survive a failed restart and leave the preview partially alive but inconsistent.

**Why:** A stale process caused the OpenShelf preview and API restart to fail while the application code and Admin button were healthy, making the UI appear unresponsive.

**How to apply:** Clear only confirmed stale processes for the affected artifact services, restart the managed workflows once, and verify both the web route and API health endpoint before diagnosing UI behavior.