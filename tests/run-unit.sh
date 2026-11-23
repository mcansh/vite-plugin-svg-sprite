#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
# shellcheck source=tests/node-bin.sh
source "$PWD/tests/node-bin.sh"

node_version="${1:?Expected a Node version}"
node_binary="$(node_bin_for "$node_version")"
case "$("$node_binary" --version)" in
  "v$node_version"|"v$node_version".*) ;;
  *)
    echo "Expected Node $node_version, got $("$node_binary" --version)" >&2
    exit 1
    ;;
esac

cd packages/vite-plugin-svg-sprite
# Same command as this package's test script, using the matrix Node binary.
# Node 20's test runner does not discover .ts files, so the file is named here.
exec "$node_binary" --import ./register-node-tsx.js --test src/index.test.ts
