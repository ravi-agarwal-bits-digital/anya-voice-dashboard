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

- Active PR: None.
- Last merged PR: #56 lead-total-cost Ledger view fix.
- Current production issue: None known.
- Next approved task: Routine product QA and future backend/SSO planning when needed.
- Known risks: Browser/device coverage is limited to local smoke checks; real workbook timing varies by device and browser. Hidden UI is retained in source for later restoration.
- Tests to run: `node --check js/dashboard.js`, admin/dashboard/workbook smoke tests, responsive smoke test, large-workbook performance smoke, reduced-view visibility checks, and `git diff --check`.

## Review checklist
- Did the change alter `index.html`?
- Did it expose confidential data?
- Did it change encryption or password behavior?
- Did it change global filters?
- Were raw and final data grains kept distinct?
- Were tests and `git diff --check` run?
