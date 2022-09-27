#!/usr/bin/env bash

set -e
set -u

#
# Usage: increment-version.sh [-f] [commit base]
#
# Increments the patch version on VERSION.md
#
# If -f is specified, triggers a build even with
# no detected changes.
#
# If commit is specified, pushes the new version
# to the repository. base snould be either
# master or beta.
#

## START STANDARD BUILD SCRIPT INCLUDE
# adjust relative paths as necessary
THIS_SCRIPT="$(greadlink -f "${BASH_SOURCE[0]}" 2>/dev/null || readlink -f "${BASH_SOURCE[0]}")"
. "$(dirname "$THIS_SCRIPT")/build-utils.sh"
## END STANDARD BUILD SCRIPT INCLUDE

. "$(dirname "$THIS_SCRIPT")/trigger-definitions.inc.sh"
. "$(dirname "$THIS_SCRIPT")/trigger-builds.inc.sh"
. "$(dirname "$THIS_SCRIPT")/sentry-control.inc.sh"

gitbranch=`git branch --show-current`

FORCE=0
HISTORY_FORCE=

if [[ $# -gt 0 ]]; then
  if [[ "$1" == "-f" ]]; then
    FORCE=1
    HISTORY_FORCE=--force
    shift
  fi
fi

if [[ $# -gt 0 ]]; then
  # We want the action to specify the branch as a consistency check
  # for now at least.

  action=$1
  if [[ $# -gt 1 ]]; then
    base=$2
  else
    action=help
  fi

  if [[ $action == commit ]]; then
    if [ "$base" != "master" ] && [ "$base" != "beta" ] && [[ ! "$base" =~ ^stable-[0-9]+\.[0-9]+$ ]]; then
      echo "Invalid branch $base specified: must be master, beta, or stable-x.y."
      exit 1
    fi

    if [ "$base" != "$gitbranch" ]; then
      echo "Branch doesn't match currently checked out branch."
      exit 2
    fi
  fi
else
  action="increment"
  base="$gitbranch"
fi

if [[ $action == help ]]; then
  echo "Usage: increment-version.sh [-f] [commit base]"
  echo "  -f  forces a build even with no changes"
  echo "  base must be either master, beta or stable-x.y."
  echo "  base must be equal to currently checked-out"
  echo "  branch (this may not be required in future)"
  exit 1
fi

# Let's ensure our base is up to date with GitHub to
# avoid transient errors
echo "increment-version.sh: updating branch $base from GitHub"
git pull origin $base

#
# Run the increment + history refresh
#

echo "increment-version.sh: building resources/build/version"
pushd "$REPO_ROOT"
npm ci

pushd "$REPO_ROOT/resources/build/version"
npm run build:ts
popd

echo "increment-version.sh: running resources/build/version"
pushd "$REPO_ROOT"
ABORT=0
node resources/build/version/lib/index.js history version -t "$GITHUB_TOKEN" -b "$base" $HISTORY_FORCE || ABORT=$?

if [[ $ABORT = 1 ]]; then
  if [[ $FORCE = 0 ]]; then
    echo "Skipping version increment from $VERSION: no recently merged pull requests were found"
    if [ ! -z "${TEAMCITY_VERSION-}" ]; then
      # Send TeamCity a build status
      echo "##teamcity[buildStatus status='SUCCESS' text='Skipping version increment from $VERSION: no recently merged pull requests were found']"
    fi
    exit 0
  else
    echo "Force specified; building even though no changes were detected"
  fi
elif [[ $ABORT != 0 ]]; then
  echo "Failed to complete version history check"
  exit $ABORT
fi
popd > /dev/null

#
# Push the result
#

if [ "$action" == "commit" ]; then
  echo "increment-version.sh: committing to repository and tagging release version $VERSION_WITH_TAG"
  VERSION_MD="$REPO_ROOT/VERSION.md"
  NEWVERSION=`cat $VERSION_MD | tr -d "[:space:]"`

  pushd "$REPO_ROOT" > /dev/null
  message="auto: increment $base version to $NEWVERSION"
  branch="auto/version-$base-$NEWVERSION"
  git tag -a "release-$VERSION_WITH_TAG" -m "Keyman release $VERSION_WITH_TAG"
  git checkout -b "$branch"
  git add VERSION.md HISTORY.md

  # Now that all version-related changes are ready and git-added, it's time to commit.
  git commit -m "$message"
  git push --tags origin "$branch"
  git checkout $base

  #
  # Tell Sentry about this (previous version)
  #

  makeSentryRelease
  popd > /dev/null

  #
  # Trigger builds for the previous version on TeamCity and Jenkins
  #

  triggerBuilds

  #
  # Now, create the PR on GitHub which will be merged when ready
  #

  cd "$REPO_ROOT"
  git checkout "$branch"
  hub pull-request -f --no-edit -b $base -l auto

  #
  # Done
  #

  echo "Version was incremented and pull request was created, and builds were triggered"
  if [ ! -z "${TEAMCITY_VERSION-}" ]; then
    # Send TeamCity a build status
    echo "##teamcity[buildStatus status='SUCCESS' text='Version was incremented from $VERSION to $NEWVERSION and pull request was created']"
  fi

  #
  # After this script finishes in CI, we will be pushing the new history to
  # downloads.keyman.com, so we need to finish with the branch here that has the
  # latest history in it. We don't need to cleanup the branch because the CI will
  # do that for us.
  #
fi

exit 0
