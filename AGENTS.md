# Anya Voice Dashboard — Codex instructions

## Project
- Static GitHub Pages dashboard.
- No backend, SSO, Cloudflare, or server-side assumptions.
- Repository is public.

## Security
- Never commit passwords, passphrases, tokens, raw Excel files, customer lists, or strategic business details.
- Preserve client-side encryption and existing `AANYAENC1` / `ANYAENC1` compatibility.
- Dashboard data must remain encrypted at rest.
- Admin upload controls must remain separate from the public dashboard.

## Change safety
- First inspect the repository and explain the architecture.
- Then propose a plan.
- Wait for approval before making substantial changes.
- Do not modify `index.html` unless explicitly approved.
- Preserve the existing theme, branding, and global filters.
- Use one focused branch and one focused pull request per mission.
- Do not mix UX redesign, data logic, security, and feature work in one PR.

## Workflow
1. Start from latest `main`.
2. Create a meaningful branch named `codex/<purpose>`.
3. Read `AGENTS.md` and `docs/PROJECT_STATUS.md`.
4. Inspect before editing.
5. Make the smallest safe change.
6. Run relevant tests and smoke checks.
7. Run `git diff --check`.
8. Summarize files changed, risks, and verification before opening a PR.

## Important metric rule
- Raw worksheet rows and final unique Call-ID rows are different grains.
- Admin review must clearly distinguish raw counts from final deduplicated counts.
- Dashboard analytics use the final unique Call-ID grain unless explicitly documented otherwise.