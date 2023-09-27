#!/bin/sh
set -e

INPUT_COMMIT_MESSAGE=${INPUT_COMMIT_MESSAGE:-$(git log -n 1 --pretty=format:%s)}
REPOSITORY=${INPUT_REPOSITORY:-$GITHUB_REPOSITORY}

[ -z "$INPUT_GITHUB_TOKEN" ] && {
    echo "GITHUB_TOKEN is empty, please provide one.";
    exit 1;
};

cd .

EMAIL="$(git log -n 1 --pretty=format:%ae)"
USERNAME="$(git log -n 1 --pretty=format:%au)"
REMOTE_REPO="https://github.com/$REPOSITORY.git"

rm -rf .git
git init
git config --local url."https://x:${INPUT_GITHUB_TOKEN}@github.com".insteadOf "https://github.com"
git config --local --add safe.directory "$INPUT_DIRECTORY"
git config --local --add user.email "$EMAIL"
git config --local --add user.name "$USERNAME"
git branch -m "$INPUT_BRANCH"
git add .
git commit -m "$INPUT_COMMIT_MESSAGE"
git remote add origin "$REMOTE_REPO"
git push -u --force origin "$INPUT_BRANCH";