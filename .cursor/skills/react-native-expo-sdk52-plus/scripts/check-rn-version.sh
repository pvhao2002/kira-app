#!/usr/bin/env sh
# Print react-native version from an app package.json and a short New Architecture hint.
# Usage: ./scripts/check-rn-version.sh [path-to-app-directory]
# Default: current working directory.

set -e
APP_DIR="${1:-.}"
PKG="${APP_DIR%/}/package.json"

if ! test -f "$PKG"; then
  echo "No package.json at $PKG" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to read $PKG" >&2
  exit 1
fi

RN_VER="$(node -e "const p=require(process.argv[1]);const d=p.dependencies||{};const dd=p.devDependencies||{};process.stdout.write(d['react-native']||dd['react-native']||'')" "$PKG")"

if test -z "$RN_VER"; then
  echo "react-native not listed in dependencies of $PKG" >&2
  exit 1
fi

echo "react-native: $RN_VER"

# Rough semver hints (works for common tags like 0.81.5, ^0.82.0, ~0.81.5)
MAJ="$(printf '%s' "$RN_VER" | sed -n 's/^[^0-9]*\([0-9][0-9]*\).*/\1/p')"
MIN="$(printf '%s' "$RN_VER" | sed -n 's/^[^0-9]*[0-9][0-9]*\.\([0-9][0-9]*\).*/\1/p')"

if test -n "$MAJ" && test -n "$MIN"; then
  if test "$MAJ" -ge 1 2>/dev/null; then
    echo "Hint: RN 1.x — verify New Architecture and Expo SDK notes in SKILL.md."
  elif test "$MAJ" -eq 0 && test "$MIN" -ge 82 2>/dev/null; then
    echo "Hint: RN 0.82+ — New Architecture is mandatory; legacy toggles are ignored."
  elif test "$MAJ" -eq 0 && test "$MIN" -ge 76 2>/dev/null; then
    echo "Hint: RN 0.76–0.81 — New Architecture default; use interop window before jumping to 0.82+."
  else
    echo "Hint: RN < 0.76 — plan stepped upgrades; see SKILL.md migration section."
  fi
else
  echo "Hint: see SKILL.md (React Native / Expo) for architecture and upgrade guidance."
fi
