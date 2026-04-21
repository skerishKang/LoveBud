#!/usr/bin/env bash
set -euo pipefail

# Set working directory to the project root
cd "$(dirname "${BASH_SOURCE[0]}")/.."

msg="${1:-local snapshot}"

echo "[Fossil] Adding/Removing files from checkout..."
fossil addremove

echo "[Fossil] Committing changes..."
fossil commit -m "$msg"

echo -e "\n[Fossil] Done."
