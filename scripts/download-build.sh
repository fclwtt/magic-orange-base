#!/bin/bash
set -e

echo "==> Downloading latest build artifacts from GitHub Actions..."
gh run download --name build-output -D /tmp/build-output

echo "==> Restoring dist/ and dist-runtime/..."
rm -rf dist dist-runtime
cp -r /tmp/build-output/dist . 2>/dev/null || true
cp -r /tmp/build-output/dist-runtime . 2>/dev/null || true

echo "==> Running runtime postbuild..."
node scripts/runtime-postbuild.mjs 2>/dev/null || true

echo ""
echo "✅ Build output restored. Test with:"
echo "   node openclaw.mjs --help"
