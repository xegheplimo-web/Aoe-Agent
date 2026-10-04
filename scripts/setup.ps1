# scripts\setup.ps1 — reproduce the dev environment (PROJECT-DELIVERY-CONTRACT.md §11).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host '== Node dependencies'
if (Test-Path 'package-lock.json') { & npm.cmd ci } else { & npm.cmd install }
if ($LASTEXITCODE) { throw 'npm install failed' }

Write-Host '== Python venv (3.11)'
if (-not (Test-Path '.venv')) {
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        & uv venv --python 3.11 .venv
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        & py -3.11 -m venv .venv
    } else {
        throw 'Neither uv nor the py launcher is available to create a Python 3.11 venv'
    }
    if ($LASTEXITCODE) { throw 'venv creation failed' }
}

$py = '.\.venv\Scripts\python.exe'
Write-Host '== Python dependencies'
& $py -m pip install --upgrade pip
& $py -m pip install -r requirements.txt ruff mypy
& $py -m pip check
if ($LASTEXITCODE) { throw 'pip install failed' }

if (-not (Test-Path '.env') -and (Test-Path '.env.example')) {
    Copy-Item '.env.example' '.env'
    Write-Host 'Created .env from .env.example — set DATABASE_URL before running the dashboard'
}

Write-Host "`nSETUP DONE — next: .\scripts\doctor.ps1" -ForegroundColor Green
