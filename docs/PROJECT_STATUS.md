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

- Active PR:
- Last merged PR:
- Current production issue:
- Next approved task:
- Known risks:
- Tests to run:

## Review checklist
- Did the change alter `index.html`?
- Did it expose confidential data?
- Did it change encryption or password behavior?
- Did it change global filters?
- Were raw and final data grains kept distinct?
- Were tests and `git diff --check` run?