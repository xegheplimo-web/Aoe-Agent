# Aegis · AoE1 Agent Lab

Windows desktop agent for AoE1 screen observation + Next.js dashboard for reviewing
run artifacts. Read `README.md` for the full manual. Workflow rules (branching,
sync, PR gates) are in `PROJECT-DELIVERY-CONTRACT.md`; stack decisions are in
`PROJECT_RULES.md`.

## Stack

- Python 3.11 — `aoe1/` package, `unittest` tests in `tests/`, deps via `requirements.txt`
- Node 24 / npm — Next.js 16, React 19, TypeScript strict, Tailwind 4, Drizzle ORM → PostgreSQL
- Lint: ESLint 9 flat config + ruff · Format: prettier + ruff-format · Types: `tsc --strict`, `mypy` (loose)

## Commands

- Full verification gate: `.\scripts\verify.ps1` (`scripts/verify.sh` on Unix)
- Environment setup: `.\scripts\setup.ps1` · health check: `.\scripts\doctor.ps1`
- Sync local main: `.\scripts\sync-main.ps1`
- Python tests: `.venv\Scripts\python -m unittest discover -s tests -v`
- Node: `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`

## Hard rules

- Never edit code while on `main` — every task starts from an exact `origin/main` SHA in its own branch/worktree.
- Never commit: `.env`, `runs/`, `diagnostics/`, `assets/*.png`, `config.json`, `.venv/`, game files.
- `run.py --live` sends real mouse/keyboard input to the game window — read README §2/§4 before enabling.
