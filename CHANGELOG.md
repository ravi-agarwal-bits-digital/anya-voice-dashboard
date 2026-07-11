# Changelog

This file records public-safe repository and application milestones. Detailed internal business logic and production data are intentionally excluded.

## Unreleased

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
