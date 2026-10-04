# PROJECT RULES — Aegis · AoE1 Agent Lab

Single source of truth for toolchain decisions. Agents MUST audit this file before
choosing tools. Do not introduce alternatives without updating this file first.

| Area               | Decision                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| OS target          | Windows 10/11 (desktop agent: capture + input). Dashboard is cross-platform.                                 |
| Python             | 3.11 · venv at `.venv/` · deps via `requirements.txt` + `pip` (or `uv pip`)                                  |
| Python tests       | `unittest` in `tests/` — `.venv\Scripts\python -m unittest discover -s tests -v`                             |
| Python lint/format | `ruff` + `ruff-format` (line-length 100, config in `pyproject.toml`)                                         |
| Python types       | `mypy` non-strict, scoped to `aoe1/` (`ignore_missing_imports` — cv2/pyautogui have no stubs)                |
| Node               | 24.x · **npm only** (lockfile `package-lock.json` must be committed)                                         |
| Frontend           | Next.js 16 App Router · React 19 · TypeScript `strict` · Tailwind CSS 4                                      |
| Database           | PostgreSQL via `drizzle-orm` · schema `src/db/schema.ts` · `npx drizzle-kit push` · `DATABASE_URL` in `.env` |
| JS test runner     | `vitest` — `npm test`; tests colocated as `*.test.ts` next to `src/` modules                                 |
| Formatter          | prettier (`npm run format` / `format:check`)                                                                 |
| ESLint             | flat config `eslint.config.mjs` + `eslint-config-next/core-web-vitals`                                       |
| Canonical commands | `scripts\verify.ps1` · `setup.ps1` · `doctor.ps1` · `sync-main.ps1` (`.sh` mirrors)                          |
| CI                 | `.github/workflows/ci.yml` — required checks: `ci / verify`, `ci / verify-python`                            |
| Registries         | npmjs + PyPI only                                                                                            |

## Rules for agents

- Do NOT switch package managers (`npm` → `pnpm`/`yarn`/`bun`) or add `pyproject.toml` `[project]` metadata; this repo is `requirements.txt`-based.
- Do NOT add pytest/jest/flake8/black — `unittest` + `vitest` + `ruff` are the chosen tools.
- New Python deps → `requirements.txt` with a bounded range (`>=x,<y`). New npm deps → `npm add` (exact version in `package.json`).
- `run.py --live` sends real input — it is a HUMAN-gated action, never run it autonomously.
- `config.json`, `assets/`, `runs/`, `diagnostics/` are local-only artifacts (gitignored).
