#!/bin/bash

if ! command -v pnpm &> /dev/null; then
  echo "✗ pnpm not found. Please install pnpm before continuing."
  exit 1
else
  echo "✔ pnpm is installed ($(pnpm --version))"
fi

total_cores=$(nproc)

if [ "$total_cores" -le 2 ]; then
  jobs=1
else
  jobs=$(( total_cores - 2 ))
fi

export MAKEFLAGS="-j${jobs}"
echo "Using MAKEFLAGS=$MAKEFLAGS (total cores was $total_cores)"

pnpm i
pnpm exec nexe --build --verbose index.js -o jqv

mkdir ~/.local/bin
cp jqv ~/.local/bin/jqv
chmod +x ~/.local/bin/jqv

echo "Installed jqv to ~/.local/bin/jqv"
echo "If its not there yet, please add it to your PATH"

