# PROJECT DELIVERY CONTRACT

Canonical autonomous-delivery pipeline for this repository. Every agent (human or
AI) that touches code here MUST follow it. Stack-specific tooling decisions live
in `PROJECT_RULES.md`; this document owns **process invariants**.

## 0. Authority model

```
GitHub (issues + labels + PR + rulesets) = control plane, queue, policy, evidence
origin/main                              = implementation source of truth
local main                               = read-only mirror/cache ONLY
Hermes (or repo owner)                   = brain / dispatcher / judge
Executors (Devin, Codex, ...)            = plan → code → verify → report
CI                                       = deterministic judge
Artifact digest                          = deployment identity
```

## 1. Hard invariants — violation ⇒ BLOCKED

1. `origin/main` is the source of truth. Local `main` is a disposable mirror.
2. No code is ever edited on `main` — not even "one small fix".
3. Every task bootstraps from an **exact, recorded `origin/main` SHA**, never from
   a possibly-stale local `main`.
4. Every agent works in its **own worktree + own branch**. No shared working dirs.
5. An Issue has exactly **one owner** (one claim lease at a time).
6. Merge is followed by **fresh-main CI** on a clean environment.
7. After merge, local `main` is synced `git pull --ff-only` back to `origin/main`.
8. A **fresh clone must reproduce** the project (setup → deps → build → test).

If any invariant cannot hold: stop, mark `agent:blocked`, report — never
"fix it by hand" (no `reset --hard`, `rebase`, `stash`, `clean -fd` on shared state).

## 2. Sync Gate — before claiming ANY task

```bash
git fetch origin --prune --tags
git status --porcelain=v1 --untracked-files=all   # must be empty on main
git rev-parse main && git rev-parse origin/main
git rev-parse 'main^{tree}' && git rev-parse 'origin/main^{tree}'
```

- local `main` == `origin/main` (SHA and tree identical) → proceed.
- local `main` is a strict ancestor (behind, clean) → `git pull --ff-only`.
- Diverged, dirty, or detached → **BLOCKED**. Report; do not self-repair.

`scripts/sync-main.ps1` implements exactly this gate.

## 3. Task bootstrap — new workspace from origin/main

```bash
BASE_SHA=$(git rev-parse origin/main)          # record it
git worktree add ../worktrees/<issue>-<slug> -b <type>/<issue>-<slug> $BASE_SHA
```

Record in the claim: `ISSUE`, `BASE_SHA`, `AGENT`, `BRANCH`, `WORKTREE`, `claimed_at`.
`git checkout -b` from local `main` is forbidden.

## 4. Issue lifecycle — label state machine

```
agent:ready → agent:claimed → agent:planning → agent:coding → agent:verifying
→ agent:pr-open → agent:ci → agent:merge-queue → agent:merged
→ agent:post-merge → agent:deployed → agent:done
Failure: agent:blocked · agent:needs-human · agent:ci-failed · agent:conflict · agent:retry
```

- Exactly one state label per issue at a time.
- `agent:ready` is the ONLY entry point; `agent:done` is the ONLY exit.
- Claims carry a lease; a stale lease (dead agent, no open PR/branch activity)
  may be reset to `agent:ready` by the dispatcher after verification.

## 5. Scope Guard

Each agent task must declare **allowed paths** and **forbidden paths** in the
issue body. Before opening a PR:

```bash
git diff --name-only "$BASE_SHA"...HEAD
```

Every changed path must match the allowlist and must not match forbidden globs
(default forbidden: `.github/**`, `infra/**`, `**/secrets*`, `*.env*`).
Out-of-scope diff ⇒ FAIL, no PR.

## 6. Toolchain discipline

- Read `PROJECT_RULES.md` before choosing any tool. Use the repo's package
  manager, test runner, linter and formatter — never substitutes.
- One canonical command verifies everything: `scripts/verify.ps1`
  (`scripts/verify.sh`). Agents must not invent per-tool invocation.
- `scripts/setup.ps1` reproduces the environment; `scripts/doctor.ps1` reports
  capability health (PASS/FAIL/WARN/NOT_APPLICABLE).

## 7. PR → CI pipeline

Required checks (canonical names — do not rename; see `.github/workflows/ci.yml`):

```
ci / verify          → npm ci · lint · typecheck · vitest · prettier · build
ci / verify-python   → ruff · mypy · unittest (windows-latest)
```

PR requirements: `Refs #<issue>` (NOT `Closes` — merge ≠ done), base SHA recorded,
verify output attached, scope diff clean, no secrets, lockfile changes reviewed.

## 8. Merge

- **Squash merge only.** Merge commits and rebase-merge disabled on the repo.
- Use the **merge queue** when ≥2 agent PRs can be in flight (CI validates the
  PR against the freshest target state). Low-traffic repos may use auto-merge.
- Third-party GitHub Actions MUST be pinned by full commit SHA (`PROJECT_RULES`
  lists them; `dependabot.yml` keeps them current).

## 9. Post-merge reconciliation

1. `main` CI runs on the **new `origin/main` SHA** in a fresh environment.
2. If this repo produces a deployable artifact: build ONCE → record
   `SOURCE_SHA + ARTIFACT_DIGEST + BUILD_ID`, then promote the same digest
   through staging → production. (N/A for this repo today — no deploy target.)
3. On success the finalizer sets `agent:done` and closes the issue — never the
   merge event itself.
4. Every local clone runs the Sync Gate → `ff-only` back to `origin/main`.
5. Cleanup: `git worktree remove` + delete local branch + `fetch --prune`.

## 10. File classification — what must exist on GitHub

| Class                                                                          | Rule                                                            |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Tracked source (`src/`, `aoe1/`, `tests/`, scripts, lockfiles, configs, docs)  | MUST be identical between clones — enforced by tree-SHA compare |
| Generated (`node_modules/`, `.next/`, `__pycache__/`, `runs/`, `diagnostics/`) | Correctly absent from GitHub                                    |
| Secrets (`.env`, tokens, `config.json` with machine paths)                     | NEVER on GitHub — `.env.example` documents required vars        |
| External assets (game files, calibration PNGs)                                 | Not in Git; must be reproducible via documented steps           |

"GitHub has a file my machine lacks" is only a defect for class 1 — and the
tree-SHA compare detects it without eyeballing.

## 11. Reproducibility gate

CI proves: fresh clone → `setup` → restore deps (lockfile) → build → test.
"Works on my machine" is rejected as evidence. If a new clone cannot build,
the delivery pipeline is broken — fix the repo, not the machine.

## 12. LFS / submodules

If the repo adopts Git LFS or submodules: `doctor` MUST check them and
`setup` MUST run `git lfs pull` / `git submodule update --init --recursive`.
Today: NOT_APPLICABLE.

## 13. Security

- `permissions: contents: read` at workflow top level; elevate per job only.
- `.env*` and anything matching `*secret*`, `*token*` never enters git or logs.
- Live-input mode (`run.py --live`) is a HUMAN gate — agents must not trigger it.
- Dependency changes are review-gated (lockfile diff in every PR).

## 14. BLOCKED conditions (stop and report)

- On `main` with source edits required · dirty worktree before claim
- `main` diverged from `origin/main` · tree-SHA mismatch after sync
- Claim conflict (issue already leased) · out-of-scope diff
- `verify` fails · secret detected · missing `origin` remote
- Anything requiring destructive git commands on shared state
