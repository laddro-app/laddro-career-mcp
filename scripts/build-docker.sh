#!/bin/bash
# Build Docker image for Cloud Run deployment.
# Copies the career-sdk dist into the build context since it's a local package.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SDK_DIR="$(dirname "$PROJECT_DIR")/laddro-career-sdk-ts"

echo "Copying career-sdk into build context..."
rm -rf "$PROJECT_DIR/career-sdk"
mkdir -p "$PROJECT_DIR/career-sdk"
cp "$SDK_DIR/package.json" "$PROJECT_DIR/career-sdk/"
cp -r "$SDK_DIR/dist" "$PROJECT_DIR/career-sdk/dist"

echo "Building Docker image..."
docker build --platform linux/amd64 \
  -t us-docker.pkg.dev/laddro-labs/gcr.io/laddro-career-mcp:production \
  "$PROJECT_DIR"

echo "Cleaning up..."
rm -rf "$PROJECT_DIR/career-sdk"

echo "Done! Push with:"
echo "  docker push us-docker.pkg.dev/laddro-labs/gcr.io/laddro-career-mcp:production"
