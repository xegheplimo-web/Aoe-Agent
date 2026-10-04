# scripts\sync-main.ps1 — Sync Gate (PROJECT-DELIVERY-CONTRACT.md §2).
# origin/main is the source of truth; local main is a read-only mirror.
# Exit 0 = in sync (or fast-forwarded). Exit 2 = BLOCKED (never auto-repairs shared state).
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

function Blocked([string]$why) {
    Write-Host "BLOCKED: $why" -ForegroundColor Red
    exit 2
}

git remote get-url origin 2>$null | Out-Null
if ($LASTEXITCODE) { Blocked 'no `origin` remote configured' }

git fetch origin --prune --tags
if ($LASTEXITCODE) { Blocked 'git fetch failed' }

$branch = git branch --show-current
$dirty = git status --porcelain=v1 --untracked-files=all

if ($branch -eq 'main' -and $dirty) { Blocked "dirty worktree on main:`n$dirty" }
if ($branch -ne 'main') {
    if ($dirty) {
        Write-Host "SKIP: on $branch with uncommitted work — nothing synced" -ForegroundColor Yellow
        exit 0
    }
    git checkout main | Out-Null
    if ($LASTEXITCODE) { Blocked 'could not switch to main' }
}

git rev-parse --verify main 2>$null | Out-Null
if ($LASTEXITCODE) {
    git checkout -b main --track origin/main | Out-Null
    if ($LASTEXITCODE) { Blocked 'local main missing and could not track origin/main' }
}

$local = git rev-parse main
$remote = git rev-parse origin/main
$state = 'IN_SYNC'

if ($local -ne $remote) {
    git merge-base --is-ancestor main origin/main
    if ($LASTEXITCODE -eq 0) {
        git pull --ff-only origin main
        if ($LASTEXITCODE) { Blocked 'fast-forward failed' }
        $state = 'FAST_FORWARDED'
    } else {
        Blocked 'local main has diverged from origin/main — resolve manually (no auto reset/rebase)'
    }
}

$ltree = git rev-parse 'main^{tree}'
$rtree = git rev-parse 'origin/main^{tree}'
if ($ltree -ne $rtree) { Blocked "tree mismatch — local=$ltree remote=$rtree" }

Write-Host ("SYNC {0} — main {1} == origin/main (tree verified)" -f $state, (git rev-parse --short main)) -ForegroundColor Green
