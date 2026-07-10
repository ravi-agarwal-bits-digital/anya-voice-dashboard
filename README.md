# Anya Voice Dashboard

Static, password-gated analytics dashboard for BITS Pilani Digital voice-call data.

## Production paths

- `index.html` — live dashboard
- `admin/index.html` — live data publishing console
- `data/voice_analytics.xlsx` — current encrypted dataset
- `assets/` — logo, favicons, and the local SheetJS runtime

The live dataset uses the legacy-compatible `AANYAENC1` encrypted format. Do not rename or move the production paths without updating both the dashboard and admin console.

## Archived material

Superseded dashboard versions and the retired admin console are retained under `_archive/`. The underscore-prefixed directory keeps these files outside the normal GitHub Pages build while preserving them for reference.

Git history remains the authoritative version history. New releases should update the canonical files rather than adding another `index-vN.html` file.
