#!/usr/bin/env bash
# Restore pinned main and apply only the reviewed unused-include deletion.
set -euo pipefail

if [[ $# -ne 2 ]]; then
  printf 'Usage: bash source.sh prepare|verify-pristine|apply|verify SOURCE_DIRECTORY\n' >&2
  exit 64
fi

mode=$1
source_dir=$2
case "$mode" in
  prepare|verify-pristine|apply|verify) ;;
  *) printf 'Unknown source mode: %s\n' "$mode" >&2; exit 64 ;;
esac

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
upstream_sha=8224f2f8279061af827ca17c36985e40a6833242
patch_sha=2cd2ec26eaa40be014e719dde09da5cc548798271727dbb46fe1db72ac35a770
baseline_sha=8d971cc859c9f0e1ad2551427de6ef34f2dab1d45de22b5e70a21337fd4f6937
candidate_sha=c798c475fa62614fed4f82a92bcf98b4de07672cd8fb0a72148c182343a3c0b1
patch_path="$script_dir/realsense-build-fix.patch"
demo_path="$source_dir/examples/hardware_registry_demo.cpp"

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
fi

test "$(git -C "$source_dir" rev-parse HEAD)" = "$upstream_sha"
git -C "$source_dir" diff --cached --quiet

if [[ "$mode" != verify ]]; then
  git -C "$source_dir" diff --quiet HEAD
  printf '%s  %s\n' "$baseline_sha" "$demo_path" | sha256sum --check
  git -C "$source_dir" apply --check "$patch_path"
fi

if [[ "$mode" == apply ]]; then
  git -C "$source_dir" apply "$patch_path"
fi

if [[ "$mode" == apply || "$mode" == verify ]]; then
  test "$(git -C "$source_dir" diff --name-only HEAD)" = examples/hardware_registry_demo.cpp
  git -C "$source_dir" diff --check
  git -C "$source_dir" apply --reverse --check "$patch_path"
  printf '%s  %s\n' "$candidate_sha" "$demo_path" | sha256sum --check
  test "$(git -C "$source_dir" -c color.ui=false diff --full-index | sha256sum | cut -d ' ' -f 1)" = "$patch_sha"
  git -C "$source_dir" diff --stat
  printf 'source_state=candidate\ncandidate_sha256=%s\n' "$candidate_sha"
else
  printf 'source_state=pristine\nbaseline_sha256=%s\n' "$baseline_sha"
fi

printf 'upstream_commit=%s\npatch_sha256=%s\n' "$upstream_sha" "$patch_sha"
