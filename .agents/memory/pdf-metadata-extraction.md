---
name: PDF metadata extraction
description: Durable rules for inferring book metadata from readable PDF first pages.
---

When PDF metadata is missing, first-page text may list the author as an unlabelled name, but it often also lists translators, editors, reviewers, and adaptation credits. Author inference should recognize explicit author labels and conservative person-name patterns while excluding those contributor roles. Browser PDF text can also split a name into spaced glyphs, so normalize only text items with clear single-character fragmentation.

**Why:** Islamic book covers and title pages commonly place contributor credits beside the author without labels, so broad “first name-like line” matching can save the wrong person as the author.

**How to apply:** Keep the extracted title and author fields editable before saving. Prefer PDF metadata, then labeled first-page text, then conservative readable-text fallbacks; leave the fallback value when the page is scanned or ambiguous.