#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "First run - installing dependencies..."
  npm install
fi

echo ""
echo "ChatDeck"
echo "  http://localhost:3456"
echo ""

npm run dev
