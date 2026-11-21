#!/usr/bin/env bash
# Commits the given paths to main from GitHub Actions, retrying if someone pushed meanwhile.
# Usage: MESSAGE="..." scripts/ci-commit.sh <path>...
set -euo pipefail
git config user.name "morning-edition-bot"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -- "$@"
if git diff --cached --quiet; then echo "Nothing to commit"; exit 0; fi
git commit -q -m "$MESSAGE"
for attempt in 1 2 3 4; do
  if git pull -q --rebase origin main && git push -q origin HEAD:main; then echo "Pushed: $MESSAGE"; exit 0; fi
  sleep $((attempt * 5))
done
echo "Push failed after 4 attempts" >&2
exit 1
