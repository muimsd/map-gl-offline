# Instructions to Remove API Key from Git History

## ⚠️ WARNING
This will rewrite git history. **BACKUP YOUR REPOSITORY** before proceeding!

## Option 1: Using git-filter-repo (Recommended)

### Step 1: Install git-filter-repo
```bash
# On macOS with Homebrew
brew install git-filter-repo

# Or with pip
pip3 install git-filter-repo
```

### Step 2: Create a replacement file
Create a file named `replacements.txt` with:
```
REDACTED_API_KEY==>REDACTED_API_KEY
```

### Step 3: Run git-filter-repo
```bash
git filter-repo --replace-text replacements.txt --force
```

### Step 4: Clean up and push
```bash
# Review changes
git log --oneline -10

# Force push to remote (⚠️ WARNING: This rewrites history!)
git push origin --force --all
git push origin --force --tags
```

## Option 2: Using BFG Repo-Cleaner

### Step 1: Install BFG
```bash
# On macOS with Homebrew
brew install bfg

# Or download from https://rtyley.github.io/bfg-repo-cleaner/
```

### Step 2: Create a replacement file
Create a file named `passwords.txt` with:
```
REDACTED_API_KEY
```

### Step 3: Run BFG
```bash
bfg --replace-text passwords.txt
```

### Step 4: Clean up and push
```bash
# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push to remote (⚠️ WARNING: This rewrites history!)
git push origin --force --all
git push origin --force --tags
```

## Option 3: Manual with git filter-branch (Legacy)

Run the provided script:
```bash
chmod +x remove-api-key-from-history.sh
./remove-api-key-from-history.sh
```

## After Rewriting History

1. **All collaborators must re-clone** the repository (their existing clones will be incompatible)
2. **Update any forks** - they will also need to rebase
3. **CI/CD systems** may need to clear caches
4. **Consider rotating the API key** since it was exposed in git history

## Alternative: Keep History, Just Rotate the Key

If rewriting history is too risky:
1. Get a new API key from https://www.maptiler.com/
2. Update the `.env` file with the new key
3. Revoke/delete the old key in your Maptiler account
4. Commit the changes normally
