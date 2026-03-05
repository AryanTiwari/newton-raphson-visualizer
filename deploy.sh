#!/bin/bash

# Deploy script for GitHub Pages
# Builds the project and pushes to gh-pages branch

set -e  # Exit on error

echo "Building project..."
npm run build

echo "Switching to gh-pages branch..."
git checkout gh-pages

echo "Cleaning old files..."
git rm -rf assets index.html jsxgraph.css vite.svg newton.svg 2>/dev/null || true

echo "Copying new build..."
cp -r dist/* .

echo "Committing changes..."
git add index.html assets jsxgraph.css newton.svg
git commit -m "Deploy: $(date '+%Y-%m-%d %H:%M:%S')"

echo "Pushing to GitHub..."
git push origin gh-pages

echo "Switching back to main..."
git checkout main

echo "Done! Site deployed to GitHub Pages."
