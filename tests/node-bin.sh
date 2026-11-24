#!/usr/bin/env bash
# Print the Node binary for a version pin, using the same nub lookup as the
# compatibility smoke test: a temporary .node-version file, `nub node install`,
# then `nub node which`.

node_bin_for() {
  local version="${1:?Expected a Node version}"
  local pin_dir
  pin_dir="$(mktemp -d "${TMPDIR:-/tmp}/svg-sprite-node.XXXXXX")"
  trap 'rm -rf "$pin_dir"' RETURN
  printf '%s\n' "$version" > "$pin_dir/.node-version"
  nub node install "$version" >&2
  env -u NODE_EXECUTABLE nub --cwd "$pin_dir" node which
}
