# Anya Voice Dashboard — Project Handoff

## Current architecture
- `index.html`: production dashboard entry point.
- `js/dashboard.js`: dashboard loading, filtering, calculations, and interactions.
- `admin/index.html`: protected admin upload console.
- `js/admin.js`: workbook validation, encryption, publishing, and verification.
- `css/`: dashboard and admin styles.
- `data/`: encrypted production dataset only.

## Permanent constraints
- Public GitHub Pages repository.
- No backend, SSO, or Cloudflare architecture.
- Do not expose confidential or strategic information.
- Preserve password protection and encryption.
- Preserve the existing visual theme and top-level filters.
- Do not change `index.html` without explicit approval.

## Data definitions
- Raw rows: every worksheet row.
- Unique Call IDs: one final lifecycle row per Call ID.
- Admin review must show both raw and final counts when they differ.
- Dashboard conversation metrics use final unique records.

## Current work
Update this section after every merged PR:

- Active PR: #49 dashboard hardening and QA coverage
- Last merged PR: #48 dashboard feature extraction without workspace rebuild
- Current production issue: None known; validate responsive behavior and large-workbook performance before release.
- Next approved task: Final workspace-specific QA for PR #43 after the hardening baseline is accepted.
- Known risks: Browser/device coverage is limited to local smoke checks; real workbook timing varies by device and browser.
- Tests to run: `node --check js/dashboard.js`, admin/dashboard/workbook smoke tests, responsive smoke test, large-workbook performance smoke, and `git diff --check`.

## Review checklist
- Did the change alter `index.html`?
- Did it expose confidential data?
- Did it change encryption or password behavior?
- Did it change global filters?
- Were raw and final data grains kept distinct?
- Were tests and `git diff --check` run?
