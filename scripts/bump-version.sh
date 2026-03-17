#!/usr/bin/env bash
set -euo pipefail

USAGE="Usage: $0 <patch|minor|major>"

if [[ $# -ne 1 ]]; then
  echo "$USAGE" >&2
  exit 1
fi

BUMP_TYPE="$1"
if [[ "$BUMP_TYPE" != "patch" && "$BUMP_TYPE" != "minor" && "$BUMP_TYPE" != "major" ]]; then
  echo "$USAGE" >&2
  exit 1
fi

# Ensure we're at the repo root
cd "$(git rev-parse --show-toplevel)"

# Read current version from package.json
CURRENT=$(grep -o '"version": "[^"]*"' package.json | head -1 | cut -d'"' -f4)
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP_TYPE" in
  patch) PATCH=$((PATCH + 1)) ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
TODAY=$(date +%Y-%m-%d)

echo "Bumping version: $CURRENT → $NEW_VERSION"

# Update package.json
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW_VERSION\"/" package.json

# Update Cargo.toml (only the package version line)
sed -i '' "s/^version = \"$CURRENT\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml

# Note: tauri.conf.json reads version from package.json automatically ("version": "../package.json")

# Update CHANGELOG.md — replace [Unreleased] section and add new version header
sed -i '' "s/^## \[Unreleased\]/## [Unreleased]\n\n## [$NEW_VERSION] - $TODAY/" CHANGELOG.md

# Stage, commit, and tag
git add package.json src-tauri/Cargo.toml CHANGELOG.md
git commit -m "Release v$NEW_VERSION"
git tag "v$NEW_VERSION"

echo ""
echo "Released v$NEW_VERSION"
echo "  - Version updated in package.json, Cargo.toml"
echo "  - tauri.conf.json reads version from package.json automatically"
echo "  - CHANGELOG.md updated"
echo "  - Commit and tag v$NEW_VERSION created"
echo ""
echo "Run 'git push && git push --tags' to trigger release"
