#!/bin/bash

# Script to remove Maptiler API key from git history
# WARNING: This will rewrite git history. Make sure to backup your repo first!

echo "⚠️  WARNING: This will rewrite git history!"
echo "Make sure you have a backup of your repository."
echo ""
read -p "Do you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

API_KEY="REDACTED_API_KEY"

echo ""
echo "Replacing API key in git history..."
echo ""

# Use git filter-branch to replace the API key in all commits
git filter-branch --force --tree-filter "
    if [ -f 'src/main.ts' ]; then
        sed -i.bak 's/${API_KEY}/\${MAPTILER_API_KEY}/g' src/main.ts
        rm -f src/main.ts.bak
    fi
" --tag-name-filter cat -- --all

echo ""
echo "Cleaning up..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ Done! The API key has been removed from git history."
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Review your git history to ensure the changes are correct"
echo "2. Force push to remote: git push origin --force --all"
echo "3. Force push tags: git push origin --force --tags"
echo "4. All collaborators must re-clone the repository"
echo ""
