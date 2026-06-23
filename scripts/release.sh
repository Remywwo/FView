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

# Validate that each platform section in docs/index.html points to the
# correct asset extension. The sed above only swaps the version segment,
# so a stale or wrong extension at one platform would silently propagate.
# This step maps the i18n key in each `.dl` block to its expected extension
# and aborts the release if any mismatch is found.
validate_platform_links() {
  local docs_file="$1"
  local version="$2"

  if ! command -v python3 >/dev/null 2>&1; then
    echo "Warning: python3 not found; skipping platform-link validation." >&2
    return 0
  fi

  python3 - "$docs_file" "$version" <<'PY'
import re
import sys

docs_file, version = sys.argv[1], sys.argv[2]

# Map of i18n platform key → expected file extension
EXPECTED = {
    "download.mac": ".dmg",
    "download.win": ".exe",
    "download.lin": ".deb",
}

with open(docs_file, encoding="utf-8") as f:
    content = f.read()

# Match each <a class="dl" ...>...</a> block
blocks = re.findall(r'<a [^>]*class="dl"[^>]*>.*?</a>', content, re.DOTALL)
if not blocks:
    print(f"ERROR: no <a class=\"dl\"> blocks found in {docs_file}", file=sys.stderr)
    sys.exit(1)

errors = 0
seen = set()
for block in blocks:
    name_match = re.search(r'data-i18n="(download\.(mac|win|lin))"', block)
    if not name_match:
        continue
    key = name_match.group(1)
    platform = key.split(".")[1]
    seen.add(platform)

    href_match = re.search(r'href="([^"]+)"', block)
    if not href_match:
        print(f"ERROR: {key} block has no href", file=sys.stderr)
        errors += 1
        continue
    href = href_match.group(1)

    expected_ext = EXPECTED[key]
    if not href.lower().endswith(expected_ext):
        print(
            f"ERROR: {key} section points to {href}\n"
            f"       expected extension: {expected_ext}",
            file=sys.stderr,
        )
        errors += 1
        continue

    # Verify the version embedded in the URL matches the target version
    if f"v{version}/" not in href or f"FView.Power_{version}_" not in href:
        print(
            f"ERROR: {key} URL does not contain version v{version}:\n  {href}",
            file=sys.stderr,
        )
        errors += 1
        continue

    print(f"OK   {key}: {href.rsplit('/', 1)[-1]}")

# Verify all expected platforms are present
for plat in EXPECTED:
    if plat.split(".")[1] not in seen:
        print(f"ERROR: missing <a class=\"dl\"> block for {plat}", file=sys.stderr)
        errors += 1

sys.exit(1 if errors else 0)
PY
}

if ! validate_platform_links "$ROOT/docs/index.html" "$VERSION"; then
  echo "" >&2
  echo "✗ Platform link validation failed. Fix docs/index.html and re-run." >&2
  echo "  Expected extensions: mac=.dmg, win=.exe (x64-setup.exe), lin=.deb (amd64.deb)" >&2
  exit 1
fi

echo "✓ Platform links validated"

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
