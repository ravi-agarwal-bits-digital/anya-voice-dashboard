# Anya Voice Dashboard

Repository for the BITS Pilani Digital Anya voice analytics dashboard.

This project is maintained as a static web application. The production dashboard and administration page are served from the canonical files listed below.

## Repository structure

```text
.
├── index.html
├── README.md
├── CHANGELOG.md
├── THIRD_PARTY_NOTICES.md
├── admin/
│   └── index.html
├── assets/
│   ├── logo.jpg
│   ├── favicon.ico
│   ├── favicon-16.png
│   ├── favicon-32.png
│   ├── apple-touch-icon.png
│   └── xlsx.full.min.js
├── data/
│   ├── .gitkeep
│   └── voice_analytics.xlsx
└── _archive/
    ├── README.md
    ├── legacy-admin/
    └── legacy-dashboards/
```

## Canonical files

| Path | Purpose |
| --- | --- |
| `index.html` | Current dashboard |
| `admin/index.html` | Current administration page |
| `assets/` | Shared visual and runtime assets |
| `data/voice_analytics.xlsx` | Current application data file |
| `_archive/` | Superseded files retained for reference |

Only `index.html` and `admin/index.html` should be treated as active application entry points.

## Archived files

The `_archive/` directory contains superseded dashboard and administration files. These files are retained only for historical reference.

- Do not deploy archived files as active pages.
- Do not use archived files as the baseline for new changes.
- Use Git history and tags for version tracking.
- Do not add new `index-vN.html` files to the repository root.

## Making changes

1. Start from the latest `main` branch.
2. Create a focused working branch.
3. Update the canonical production file.
4. Keep unrelated changes out of the same pull request.
5. Validate the dashboard before merging.
6. Document the change and verification performed in the pull request.

## Minimum validation

Before merging a dashboard change:

- Confirm the page loads without JavaScript syntax errors.
- Check that HTML IDs remain unique.
- Verify the current application data loads successfully.
- Test the primary filters and interactive panels.
- Check desktop and mobile layouts.
- Confirm the administration page still targets the expected production file when relevant.
- Run `node tests/admin-smoke.test.js` when admin code changes.
- Run `node tests/dashboard-smoke.test.js` when dashboard code changes.

## Repository hygiene

- Keep the repository root limited to active files and documentation.
- Keep shared assets under `assets/`.
- Keep retired implementations under `_archive/`.
- Never commit credentials, access tokens, plaintext passwords or unapproved raw data.
- Review third-party assets before updating them.
- Use pull requests for production changes.

## Ownership

Maintained for BITS Pilani Digital.
