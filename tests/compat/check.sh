#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
compat_dir="$PWD/tests/compat"
plugin_dir="$PWD/packages/vite-plugin-svg-sprite"
node_version="${1:?Expected a Node version}"
vite_major="${2:?Expected a Vite major}"

case "$vite_major" in
  5) vite_dir="$compat_dir/node_modules/vite5" ;;
  6) vite_dir="$compat_dir/node_modules/vite" ;;
  8) vite_dir="$plugin_dir/node_modules/vite" ;;
  *) echo "Unsupported Vite major: $vite_major" >&2; exit 1 ;;
esac

fixture="$(mktemp -d "${TMPDIR:-/tmp}/svg-sprite-compat.XXXXXX")"
trap 'rm -rf "$fixture"' EXIT
# shellcheck source=tests/node-bin.sh
source "$PWD/tests/node-bin.sh"
node_binary="$(node_bin_for "$node_version")"
case "$("$node_binary" --version)" in
  "v$node_version"|"v$node_version".*) ;;
  *) echo "Expected Node $node_version" >&2; exit 1 ;;
esac

package_dir="$fixture/node_modules/@mcansh/vite-plugin-svg-sprite"
mkdir -p "$package_dir"
pnpm --dir "$plugin_dir" pack --out "$fixture/plugin.tgz"
tar -xzf "$fixture/plugin.tgz" --strip-components 1 -C "$package_dir"

dependencies="$(node -p 'Object.keys(require(process.argv[1]).dependencies).join("\n")' "$package_dir/package.json")"
while IFS= read -r dependency; do
  mkdir -p "$(dirname "$fixture/node_modules/$dependency")"
  ln -s "$plugin_dir/node_modules/$dependency" "$fixture/node_modules/$dependency"
done <<< "$dependencies"
ln -s "$vite_dir" "$fixture/node_modules/vite"
cp "$compat_dir/smoke.cjs" "$fixture/smoke.cjs"
"$node_binary" "$fixture/smoke.cjs" "$vite_major"
