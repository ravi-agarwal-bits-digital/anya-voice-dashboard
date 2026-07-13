# Changelog

This file records public-safe repository and application milestones. Detailed internal business logic and production data are intentionally excluded.

## Unreleased

- Added a reversible reduced dashboard view that hides AI/quality-heavy sections, metrics, navigation links, anomaly messaging, and detail fields while preserving operational filters, follow-up workflows, encrypted data, exports, and the existing layout.
- Tightened the reduced view by removing low-signal Ledger controls, attention/general breakdowns from repeat and priority cards, and long-tail dial-failure noise; failure reasons now show the top seven with an Other reasons roll-up.
- Renamed the visible priority area to Follow-up queue and removed heuristic Attention/General labels from Ledger rows and profile details while retaining the underlying source fields and exports.
- Added CEO-facing naming and card polish, repaired Follow-up queue and Repeat engagement profile-drawer navigation, and standardized operational CSV exports with stable Call IDs and active filter scope.
- Reduced duplicate dashboard information by making the header contextual, keeping Call flow focused on direction comparison, assigning dial mechanics to Outbound results, and making Executive summary narrative-led.
- Added clear spacing between the Follow-up queue and Repeat engagement panels.
- Reworked Callback requests into Requested follow-ups: replaced the inferred SLA with an honest readiness view, clarified requested-time coverage and scheduling gaps, and aligned adjacent profile, Ledger, and CSV terminology.
- Merged the Executive summary into the top Overview as a compact Management readout, removing the duplicate standalone destination while retaining printable leadership context and metric definitions.
- Removed the duplicate KPI strip ahead of the Management readout, expanded all sidebar groups by default, and made requested-follow-up readiness filters visibly selected when active.
- Fixed the initial dashboard render after KPI-strip consolidation so published encrypted workbooks load normally.
- Restored advisory minutes and estimated operating cost to the consolidated Management readout.
- Moved metric definitions to the dashboard bottom and rendered the Management readout before lower-page charts and tables.
- Made first-load header chips match filtered views and removed the non-actionable Source chip.
- Normalized phone grouping in Follow-up queue and Repeat engagement so card minutes and cost match the lead drawer when phone formatting differs.
- Added clear Call cost and Lead total cost Ledger sorting using the dashboard's billed-minute operating-cost assumption.
- Displayed each Ledger row's billed cost and cumulative lead cost so cost sorting is directly auditable.
- Removed the redundant Hot/Warm/Cold lead-tier breakdown from profile drawers.
- Added inbound/outbound call mix to profile-drawer call totals and collapsed long call histories behind an earlier-calls disclosure.
- Removed redundant active-view count context from profile drawers.

- Added format-tolerant global lead search, targeted profile/ledger handoffs, complete repeatedly-unreachable dial exports, publication freshness, campaign-aware Management Summary scoping, outbound operational context, and clearer applicable percentages without changing the workspace layout.
- Consolidated the top quality signal wording and removed the superseded inline repeat-caller timeline in favor of the existing profile drawer timeline.

- Added a one-click reset for the complete dashboard filter scope, explicit active-scope context in drill-down drawers and CSV exports, management metric definitions, responsive smoke coverage, and large-workbook core-processing checks.
- Added regression coverage for search, filters, drawers, CSV exports, encrypted GitHub Pages loading paths, and mobile/tablet layout contracts.

- Added raw-versus-final Call-ID status reconciliation to the Admin pre-publish review so lifecycle rows can be audited against the source worksheet without changing dashboard grain.

- Clarified Admin pre-publish review scopes by separating raw worksheet rows from final per-Call-ID status counts, surfacing lifecycle duplicates, and explicitly documenting that Admin validation is structural rather than business intelligence.

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
