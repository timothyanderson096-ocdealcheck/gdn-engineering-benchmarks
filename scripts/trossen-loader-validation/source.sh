#!/usr/bin/env bash
# Restore and verify the reviewed tests-only patch; never change upstream behavior.
set -euo pipefail

if [[ $# -ne 2 || ( "$1" != prepare && "$1" != verify ) ]]; then
  printf 'Usage: bash source.sh prepare|verify SOURCE_DIRECTORY\n' >&2
  exit 64
fi

mode=$1
source_dir=$2
script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
upstream_sha=594e7601b8f28cbc307a290c2f4685fd11dab44a
patch_sha=721682c3052cdeb34481d6cb868a9e85fbef3145ccefbf5cb02d173b898d67bf
test_sha=ce3b5b45eb41ed2eedb2f02470a3a99979b265fd7d68374b084ab464402e022d
patch_path="$script_dir/trossen_loader_regression_draft.patch"

printf '%s  %s\n' "$patch_sha" "$patch_path" | sha256sum --check
if [[ "$mode" == prepare ]]; then
  if [[ -e "$source_dir" ]]; then
    printf 'Refusing to reuse an existing source directory: %s\n' "$source_dir" >&2
    exit 1
  fi
  git init "$source_dir"
  git -C "$source_dir" remote add origin https://github.com/TrossenRobotics/trossen_sdk.git
  git -C "$source_dir" fetch --depth 1 origin "$upstream_sha"
  git -C "$source_dir" checkout --detach FETCH_HEAD
  test "$(git -C "$source_dir" rev-parse HEAD)" = "$upstream_sha"
  git -C "$source_dir" apply --check "$patch_path"
  git -C "$source_dir" apply "$patch_path"
fi

test "$(git -C "$source_dir" rev-parse HEAD)" = "$upstream_sha"
test "$(git -C "$source_dir" diff --name-only HEAD)" = tests/test_mcap_dataset_loader.cpp
git -C "$source_dir" diff --cached --quiet
git -C "$source_dir" diff --check
git -C "$source_dir" apply --reverse --check "$patch_path"
printf '%s  %s\n' "$test_sha" "$source_dir/tests/test_mcap_dataset_loader.cpp" | sha256sum --check
sha256sum "$source_dir/src/backends/trossen_mcap/mcap_dataset_loader.cpp"
git -C "$source_dir" diff --stat
printf 'upstream_commit=%s\npatch_sha256=%s\ntest_sha256=%s\n' "$upstream_sha" "$patch_sha" "$test_sha"
