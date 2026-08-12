#!/usr/bin/env bash

set -euo pipefail

demo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mkdir -p "${demo_dir}/audio"

for scene in 01 02 03 04 05 06 07 08 09; do
  say -v Samantha -r 195 \
    -f "${demo_dir}/narration/${scene}.txt" \
    -o "${demo_dir}/audio/${scene}.aiff"
done
