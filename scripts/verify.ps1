# scripts\verify.ps1 — canonical verification gate (PROJECT-DELIVERY-CONTRACT.md §6).
# Must pass locally before push/PR. Mirrors `ci / verify` + `ci / verify-python`.
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
$failed = @()

function Run-Step([string]$Name, [scriptblock]$Cmd) {
    Write-Host "`n== $Name" -ForegroundColor Cyan
    & $Cmd
    if ($LASTEXITCODE -ne 0) { $script:failed += $Name }
}

# Interpreter resolution: AOE1_PYTHON env override (for git worktrees, which cannot
# share a .venv) > local .venv > system python.
if ($env:AOE1_PYTHON -and (Test-Path $env:AOE1_PYTHON)) {
    $py = $env:AOE1_PYTHON
} else {
    $py = Join-Path $root '.venv\Scripts\python.exe'
    if (-not (Test-Path $py)) {
        $py = 'python'
        Write-Host 'WARN: .venv not found — falling back to system python (run scripts\setup.ps1 or set AOE1_PYTHON)'
    }
}

Run-Step 'lint'      { & npm.cmd run lint }
Run-Step 'typecheck' { & npm.cmd run typecheck }
Run-Step 'vitest'    { & npm.cmd test }
Run-Step 'prettier'  { & npx.cmd prettier --check . }
Run-Step 'ruff'      { & $py -m ruff check . }
Run-Step 'mypy'      { & $py -m mypy aoe1 }
Run-Step 'unittest'  { & $py -m unittest discover -s tests -v }

Pop-Location
if ($failed.Count) {
    Write-Host "`nVERIFY FAIL: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "`nVERIFY PASS" -ForegroundColor Green
