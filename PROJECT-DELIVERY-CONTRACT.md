# PROJECT DELIVERY CONTRACT — v2

Canonical autonomous-delivery pipeline for this repository. Every agent (human or
AI) that touches code here MUST follow it. Stack-specific tooling decisions live
in `PROJECT_RULES.md`; this document owns **process invariants**.

v2 change: **review is a merge precondition, not a post-merge event.** Auto-merge
may only be enabled after the current head SHA has been reviewed and zero
unresolved review threads remain.

## 0. Authority model

```
Owner (Duy)
├── Governor  → Administration, rulesets, secrets, environments, webhooks
└── Executor  → Issues, branches, code, commits, pushes, PRs, CI, fixes, merges

GitHub (issues + labels + PR + rulesets) = control plane, queue, policy, evidence
origin/main                              = implementation source of truth
local main                               = read-only mirror/cache ONLY
Hermes (or repo owner)                   = brain / dispatcher / judge
Executors (Devin, Codex, ...)            = plan → code → verify → report
CI (GitHub Actions)                      = deterministic JUDGE — never fixes code
Artifact digest                          = deployment identity
```

Executors get full development lifecycle rights — but NEVER the right to disable
the controls judging them:

| GitHub permission                                             | Executor                            |
| ------------------------------------------------------------- | ----------------------------------- |
| Metadata, Contents, Issues, Pull requests, Actions, Workflows | Read & Write                        |
| Checks, Commit statuses                                       | Read & Write (custom gates only)    |
| Secrets, Administration, Environments, Webhooks, Billing      | NEVER                               |
| Ruleset bypass / direct push to `main`                        | NEVER — `bypass_actors` stays empty |

## 1. Hard invariants — violation ⇒ BLOCKED

1. `origin/main` is the source of truth. Local `main` is a disposable mirror.
2. No code is ever edited on `main` — not even "one small fix".
3. Every task bootstraps from an **exact, recorded `origin/main` SHA**, never from
   a possibly-stale local `main`.
4. Every agent works in its **own worktree + own branch**. No shared working dirs.
5. An Issue has exactly **one owner** (one claim lease at a time).
6. **Every commit invalidates prior review and CI.** HEAD `abc` reviewed/green
   means nothing for `def` — new head requires new review + new CI before merge.
7. Merge is followed by **fresh-main CI** on a clean environment.
8. After merge, local `main` is synced `git pull --ff-only` back to `origin/main`.
9. A **fresh clone must reproduce** the project (setup → deps → build → test).

If any invariant cannot hold: stop, mark `agent:blocked`, report — never
"fix it by hand" (no `reset --hard`, `rebase`, `stash`, `clean -fd` on shared
state).

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

Record in the claim: `ISSUE`, `BASE_SHA`, `AGENT`, `BRANCH`, `WORKTREE`,
`claimed_at`. `git checkout -b` from local `main` is forbidden.

## 4. Issue lifecycle — label state machine

```
agent:ready → agent:claimed → agent:planning → agent:coding → agent:verifying
→ agent:pr-open → agent:ci + agent:review
    ├── CI fail      → agent:ci-failed     → agent:fixing → agent:verifying → agent:ci
    ├── review fail  → agent:review-failed → agent:fixing → agent:verifying → agent:review
    └── all green    → agent:merge-queue → agent:merged → agent:post-merge → agent:done

Stuck: agent:blocked · agent:needs-human · agent:conflict · agent:retry
```

- Exactly one state label per issue at a time.
- `agent:ready` is the ONLY entry point; `agent:done` is the ONLY label allowed
  to close an issue.
- Claims carry a lease; a stale lease (dead agent, no open PR/branch activity)
  may be reset to `agent:ready` by the dispatcher after verification.

## 5. Scope Guard

Each agent task must declare **allowed paths** and **forbidden paths** in the
issue body. Enforced twice: locally before push, and by `ci / scope` on the PR.

```bash
git diff --name-only "$BASE_SHA"...HEAD
```

Every changed path must match the allowlist and must not match forbidden globs.
Default forbidden: `.env*`, `config.json`, `runs/`, `diagnostics/`, `.venv/`,
`assets/*.png`, `node_modules/`, `*secret*`, `*.pem`, `*.key`. `.github/**` is
not forbidden by default — touching it requires the task to declare it.
`ci / scope` also secret-scans added lines (token formats, private keys).

Out-of-scope diff ⇒ FAIL, no PR.

## 6. Toolchain discipline

- Read `PROJECT_RULES.md` before choosing any tool. Use the repo's package
  manager, test runner, linter and formatter — never substitutes.
- One canonical command verifies everything: `scripts/verify.ps1`
  (`scripts/verify.sh`). Agents must not invent per-tool invocation.
- `scripts/setup.ps1` reproduces the environment; `scripts/doctor.ps1` reports
  capability health (PASS/FAIL/WARN/NOT_APPLICABLE).

## 7. PR → CI + review pipeline

Required checks (canonical names — do not rename; see `.github/workflows/ci.yml`):

```
ci / scope           → forbidden paths + secret scan on the PR diff      (PR only)
ci / verify          → npm ci · lint · typecheck · vitest · prettier · build
ci / verify-python   → ruff · mypy · unittest                            (windows)
ci / security        → npm audit (critical) + pip-audit
ci / review-gate     → reviewer on current head SHA + 0 unresolved       (PR only)
```

Rules:

- PR body carries `Refs #<issue>` (NOT `Closes` — merge ≠ done), base SHA,
  verify output, scope diff clean, no secrets, lockfile changes reviewed.
- **Auto-merge is enabled ONLY after `ci / review-gate` passes** — i.e. a review
  exists on the current head SHA and no unresolved threads. Never enable
  auto-merge at PR-open time.
- Review findings are fixed like CI failures (§7a). Every fix push creates a
  new head → prior review/CI no longer count.
- Ruleset additionally enforces `required_conversation_resolution`, so an
  unresolved thread hard-blocks the merge button itself.

## 7a. Automatic remediation loop — bounded

```
CI or review FAIL
  → read failed job / review thread
  → identify root cause
  → fix in worktree
  → scripts/verify.ps1
  → commit + push
  → CI + review run again on the NEW head
```

`MAX_FIX_CYCLES = 5`. On the 5th failure the agent stops, applies
`agent:blocked`, and comments:

```
BLOCKED
Attempts: 5
Failure: <what failed>
Suspected root cause: <analysis>
Changed: <files touched>
Recommended next action: <what a human should do>
```

No infinite repair loops. CI is the judge — it never edits source.

## 8. Merge

- **Squash merge only.** Merge commits and rebase-merge disabled on the repo.
- Use the **merge queue** when ≥2 agent PRs can be in flight; low-traffic repos
  may use auto-merge (armed only after the review gate clears, §7).
- Third-party GitHub Actions MUST be pinned by full commit SHA (`PROJECT_RULES`
  lists them; `dependabot.yml` keeps them current).
- NO agent bypasses the PR path: `git push origin main` is never permitted.

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

- `permissions: contents: read` at workflow top level; elevate per job only
  (`review-gate` gets `pull-requests: read`).
- `.env*` and anything matching `*secret*`, `*token*` never enters git or logs.
- Live-input mode (`run.py --live`) is a HUMAN gate — agents must not trigger it.
- Dependency changes are review-gated (lockfile diff in every PR).
- Executors never hold: Secrets, Administration, Environments, Webhooks,
  Billing, ruleset bypass (§0).

## 14. BLOCKED conditions (stop and report)

- On `main` with source edits required · dirty worktree before claim
- `main` diverged from `origin/main` · tree-SHA mismatch after sync
- Claim conflict (issue already leased) · out-of-scope diff · secret detected
- `verify` fails after MAX_FIX_CYCLES · review thread unresolved after fixes
- `ci / review-gate` times out (no reviewer) · missing `origin` remote
- Anything requiring destructive git commands on shared state
