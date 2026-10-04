# scripts\doctor.ps1 — environment health report (PROJECT-DELIVERY-CONTRACT.md §11).
# Prints PASS / WARN / FAIL / NOT_APPLICABLE per check. Exit 1 if any FAIL.
$ErrorActionPreference = 'Continue'
Set-Location (Split-Path -Parent $PSScriptRoot)
$rows = @()

function Add-Row([string]$Check, [string]$Status, [string]$Detail) {
    $script:rows += [pscustomobject]@{ Check = $Check; Status = $Status; Detail = $Detail }
}
function Cmd([string]$c) { (Get-Command $c -ErrorAction SilentlyContinue) -ne $null }

# --- toolchain -------------------------------------------------------------
if (Cmd 'git')    { Add-Row 'git' 'PASS' ((git --version) -join ' ') } else { Add-Row 'git' 'FAIL' 'not installed' }
if (Cmd 'gh')     { Add-Row 'gh' 'PASS' ((gh --version | Select-Object -First 1) -join ' ') } else { Add-Row 'gh' 'WARN' 'GitHub CLI not installed' }
if (Cmd 'gh') {
    gh auth status 2>$null | Out-Null
    Add-Row 'gh auth' $(if ($LASTEXITCODE -eq 0) { 'PASS' } else { 'WARN' }) $(if ($LASTEXITCODE -eq 0) { 'authenticated' } else { 'run: gh auth login' })
}
if (Cmd 'node')   { Add-Row 'node' 'PASS' (node --version) } else { Add-Row 'node' 'FAIL' 'not installed' }
if (Cmd 'npm')    { Add-Row 'npm' 'PASS' (npm --version) } else { Add-Row 'npm' 'FAIL' 'not installed' }
if (Cmd 'uv')     { Add-Row 'uv' 'PASS' (uv --version) } else { Add-Row 'uv' 'WARN' 'optional — used for fast Python 3.11 venvs' }
if (Cmd 'tesseract') { Add-Row 'tesseract' 'PASS' ((tesseract --version 2>$null | Select-Object -First 1) -join ' ') } else { Add-Row 'tesseract' 'WARN' 'required for OCR (live capture)' }

# --- repo state ------------------------------------------------------------
if (Test-Path '.git') { Add-Row 'git repo' 'PASS' '' } else { Add-Row 'git repo' 'FAIL' 'run: git init -b main' }
$origin = git remote get-url origin 2>$null
Add-Row 'origin remote' $(if ($origin) { 'PASS' } else { 'WARN' }) $(if ($origin) { $origin } else { 'not configured — add GitHub remote' })

if ($origin -and (Test-Path '.git')) {
    git fetch origin --prune --tags 2>$null | Out-Null
    $l = git rev-parse --verify main 2>$null
    $r = git rev-parse --verify origin/main 2>$null
    if (-not $r) {
        Add-Row 'origin/main' 'WARN' 'remote has no main yet'
    } elseif (-not $l) {
        Add-Row 'main sync' 'WARN' 'no local main — run scripts\sync-main.ps1'
    } elseif ($l -ne $r) {
        git merge-base --is-ancestor main origin/main 2>$null
        Add-Row 'main sync' $(if ($LASTEXITCODE -eq 0) { 'WARN' } else { 'FAIL' }) $(if ($LASTEXITCODE -eq 0) { 'behind — run sync-main.ps1' } else { 'DIVERGED — manual fix' })
    } else {
        $lt = git rev-parse 'main^{tree}'; $rt = git rev-parse 'origin/main^{tree}'
        Add-Row 'main sync' $(if ($lt -eq $rt) { 'PASS' } else { 'FAIL' }) $(if ($lt -eq $rt) { "SHA+tree match $($l.Substring(0,7))" } else { 'tree mismatch' })
    }
}

$dirty = git status --porcelain=v1 --untracked-files=all 2>$null
Add-Row 'worktree' $(if ($dirty) { 'WARN' } else { 'PASS' }) $(if ($dirty) { 'uncommitted changes present' } else { 'clean' })

# --- dependencies ----------------------------------------------------------
Add-Row 'package-lock.json' $(if (Test-Path 'package-lock.json') { 'PASS' } else { 'WARN' }) $(if (Test-Path 'package-lock.json') { '' } else { 'missing — run npm install and commit it' })
Add-Row 'node_modules' $(if (Test-Path 'node_modules') { 'PASS' } else { 'WARN' }) ''
$venvPy = '.\.venv\Scripts\python.exe'
if (Test-Path $venvPy) {
    $v = & $venvPy --version 2>$null
    Add-Row '.venv' $(if ($v -match '3\.11') { 'PASS' } else { 'WARN' }) $v
} else { Add-Row '.venv' 'WARN' 'missing — run scripts\setup.ps1' }
Add-Row '.env' $(if (Test-Path '.env') { 'PASS' } else { 'WARN' }) $(if (Test-Path '.env') { '' } else { 'copy .env.example, set DATABASE_URL' })

# --- optional repo features --------------------------------------------------
$lfs = git lfs ls-files 2>$null
Add-Row 'git LFS' $(if ($lfs) { 'WARN' } else { 'NOT_APPLICABLE' }) $(if ($lfs) { 'LFS files present — ensure `git lfs pull`' } else { 'no LFS objects' })
Add-Row 'submodules' $(if (Test-Path '.gitmodules') { 'WARN' } else { 'NOT_APPLICABLE' }) $(if (Test-Path '.gitmodules') { 'run: git submodule update --init --recursive' } else { '' })

$rows | Format-Table -AutoSize
$fail = ($rows | Where-Object Status -eq 'FAIL').Count
$warn = ($rows | Where-Object Status -eq 'WARN').Count
Write-Host ("`nDOCTOR: {0} PASS · {1} WARN · {2} FAIL" -f ($rows | Where-Object Status -eq 'PASS').Count, $warn, $fail)
if ($fail) { exit 1 }
