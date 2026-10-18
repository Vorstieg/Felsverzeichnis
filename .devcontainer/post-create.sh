#!/usr/bin/env bash
set -e

# Mark workspace directory as safe for git
git config --global --add safe.directory "${PWD}" || true

echo "Configuring development environment..."

# Check if .npmrc exists; if not, attempt to configure from environment tokens
if [ ! -f .npmrc ]; then
  TOKEN="${NODE_AUTH_TOKEN:-${GITHUB_TOKEN:-}}"
  if [ -z "$TOKEN" ] && command -v gh >/dev/null 2>&1; then
    TOKEN=$(gh auth token 2>/dev/null || true)
  fi

  if [ -n "$TOKEN" ]; then
    echo "Creating .npmrc using available GitHub authentication token..."
    cat <<EOF > .npmrc
@vorstieg:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${TOKEN}
EOF
  fi
fi

# If .npmrc is present, install project dependencies
if [ -f .npmrc ]; then
  echo "Installing npm dependencies..."
  npm install

  echo "Installing Playwright Chromium browser binary..."
  npx playwright install chromium || true

  echo "Dev container setup complete!"
else
  echo "===================================================================="
  echo "⚠️  Note: @vorstieg packages are published on GitHub Packages."
  echo "To install project dependencies:"
  echo "  1. Copy .npmrc.example to .npmrc and add your GitHub PAT"
  echo "     (or set NODE_AUTH_TOKEN / authenticate via 'gh auth login')"
  echo "  2. Run: npm install"
  echo "===================================================================="
fi
