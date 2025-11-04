#!/bin/bash
# Wrapper script for playwright-session CLI
# Usage: ./playwright-session.sh <command> [args...]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$SCRIPT_DIR/dist/cli.js"

if [ ! -f "$CLI_PATH" ]; then
  echo "Error: CLI not built. Run 'npm run build' first."
  exit 1
fi

node "$CLI_PATH" "$@"
