#!/usr/bin/env bash
# scripts/setup.sh — reproduce the dev environment (PROJECT-DELIVERY-CONTRACT.md §11).
# The desktop agent is Windows-targeted; on Unix this sets up what's portable.
set -euo pipefail
cd "$(dirname "$0")/.."

echo '== Node dependencies'
if [ -f package-lock.json ]; then npm ci; else npm install; fi

echo '== Python venv (3.11)'
if [ ! -d .venv ]; then
    if command -v uv >/dev/null 2>&1; then
        uv venv --python 3.11 .venv
    else
        python3.11 -m venv .venv
    fi
fi
PY=".venv/Scripts/python.exe"; [ -f "$PY" ] || PY=".venv/bin/python"

echo '== Python dependencies'
"$PY" -m pip install --upgrade pip
"$PY" -m pip install -r requirements.txt ruff mypy
"$PY" -m pip check

if [ ! -f .env ] && [ -f .env.example ]; then
    cp .env.example .env
    echo 'Created .env — set DATABASE_URL before running the dashboard'
fi

echo 'SETUP DONE — next: scripts/doctor.sh'
