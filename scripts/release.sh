#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.1.3"
  exit 1
fi

VERSION="$1"
shift

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must be semver (e.g. 0.1.3)"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Bump version in all three files
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT/package.json" "$ROOT/src-tauri/tauri.conf.json"
sed -i '' "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" "$ROOT/src-tauri/Cargo.toml"

# Update docs asset names
sed -i '' "s/FView\.Power_[0-9.]*_/FView.Power_${VERSION}_/g" "$ROOT/docs/index.html"
sed -i '' "s|/download/v[0-9.]*/FView|/download/v$VERSION/FView|g" "$ROOT/docs/index.html"

echo "✓ Bumped version to $VERSION"

# Commit and tag
git add "$ROOT/package.json" "$ROOT/src-tauri/tauri.conf.json" "$ROOT/src-tauri/Cargo.toml" "$ROOT/docs/index.html"
git commit -m "chore: bump version to $VERSION"
git push origin main

# Delete old tag + release, create new tag
REPO=$(echo "$(git remote get-url origin)" | sed 's|.*github\.com[:\/]\(.*\)\.git|\1|')
if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  git tag -d "v$VERSION"
  git push origin ":refs/tags/v$VERSION" 2>/dev/null || true
fi
gh release delete "v$VERSION" --repo "$(git remote get-url origin | sed 's/.*github\.com[:\/]\(.*\)\.git/\1/')" --yes 2>/dev/null || true

git tag "v$VERSION"
git push origin "v$VERSION"
echo "✓ Tagged and pushed v$VERSION"

echo "Release CI: https://github.com/${REPO}/actions"
