# Changelog

This file records public-safe repository and application milestones. Detailed internal business logic and production data are intentionally excluded.

## Unreleased

- Rebuilt the dashboard into focused Overview, Action Center, Intelligence, Outbound and Records workspaces, consolidated the summary layers, and preserved the production theme, global filters, analytics and CSV-enabled drawers.
- Strengthened active workspace-tab feedback, added live Action Center counts, drawer-to-ledger handoff, publication freshness, guided empty states, and unique-lead/callback direction comparisons.
- Fixed campaign scoping in the Management Summary, improved selected-tab count contrast, expanded the direction glance with outbound operating metrics, and added a complete number-level unreachable export.
- Made phone search format-tolerant and global across filter scopes, added ambiguous-number selection, and paired applicable population counts with percentages across action, profile, geography and drill-down views.

- Added callback demand to the main outcomes view, restored duration-band visibility and shortened the initial sidebar.

- Removed a redundant in-memory file conversion and reread from automatic dashboard loading.

- Prevented identical workbooks from creating redundant encrypted repository versions by recording a minimal public-safe publication fingerprint.

- Allowed conditional browser reuse of the unchanged encrypted workbook while still revalidating for updates.
- Added staged loading messages for download, decryption, parsing and dashboard preparation.
- Increased the download timeout to support the continually growing workbook on slower connections.

- Moved workbook parsing to a size-aware Web Worker with a safe main-thread fallback.
- Added dedicated workbook-worker regression coverage.

- Added characterization coverage for dashboard date, callback, disposition, billing, intent, memoisation and rendering-limit logic.

- Hardened workbook-derived dashboard rendering and inline-handler arguments.
- Added regression coverage for hostile input, completed-only billing, dense workbook parsing, phone-group memoisation and callback keyboard access.

- Aligned dashboard lifecycle deduplication with admin validation, bounded schema lookup work, cancelled stale renders and hardened large-workbook date validation.
- Expanded regression coverage for same-status duplicates, schema aliases and 130,000-row validation.

- Removed exact duplicate dashboard CSS rules and extended workflow coverage to stylesheet changes.

- Extracted dashboard and administration styles into dedicated CSS files without changing application behaviour.
- Extracted dashboard authentication and application JavaScript into dedicated files without changing execution order.
- Extracted administration JavaScript into a dedicated file without changing execution order.

## 2026-07 — Repository test and governance foundation

- Added automated dashboard regression checks using an in-memory synthetic workbook.
- Added public-safe security and ownership guidance.
- Added third-party dependency and licence documentation.
- Added repository hygiene rules for local artefacts.

## 2026-07 — Admin reliability sprint

- Added workbook validation and a pre-publish review.
- Added local encryption self-testing and post-publication verification.
- Added large-file verification support and publication history links.
- Added automated admin checks.
- Added the shared admin favicon and consolidated shared assets.

## 2026-07 — Repository cleanup

- Established canonical dashboard and admin entry points.
- Moved superseded implementations under `_archive/`.
- Added repository maintenance documentation.

## 2026-07 — Dashboard improvements

- Added inbound and outbound segmentation.
- Corrected direction-aware learner-number handling.
- Added management, campaign, cadence and operational views.
- Consolidated overlapping dashboard sections and refined navigation.

Git commits and pull requests remain the authoritative detailed history.
