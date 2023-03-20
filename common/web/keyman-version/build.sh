#!/usr/bin/env bash
#
# Builds the include script for the current Keyman version.
#

# Exit on command failure and when using unset variables:
set -eu

## START STANDARD BUILD SCRIPT INCLUDE
# adjust relative paths as necessary
THIS_SCRIPT="$(readlink -f "${BASH_SOURCE[0]}")"
. "${THIS_SCRIPT%/*}/../../../resources/build/build-utils.sh"
## END STANDARD BUILD SCRIPT INCLUDE

. "$KEYMAN_ROOT/resources/shellHelperFunctions.sh"

# This script runs from its own folder
cd "$THIS_SCRIPT_PATH"

################################ Main script ################################

builder_describe "Build the include script for current Keyman version" \
  configure \
  clean \
  build \
  publish \
  test \
  --dry-run

builder_describe_outputs \
  configure "/node_modules" \
  build     "/common/web/keyman-version/build/keyman-version.mjs"

builder_parse "$@"


if builder_start_action configure; then
  verify_npm_setup
  builder_finish_action success configure
fi

if builder_start_action clean; then
  npm run clean
  rm -f ./version.inc.ts
  builder_finish_action success clean
fi

if builder_start_action build; then
  # Generate keyman-version.mts
  echo "
    // Generated by common/web/keyman-version/build.sh
    export default class KEYMAN_VERSION {
      static readonly VERSION = \"$VERSION\";
      static readonly VERSION_RELEASE =\"$VERSION_RELEASE\";
      static readonly VERSION_MAJOR = \"$VERSION_MAJOR\";
      static readonly VERSION_MINOR = \"$VERSION_MINOR\";
      static readonly VERSION_PATCH = \"$VERSION_PATCH\";
      static readonly TIER =\"$TIER\";
      static readonly VERSION_TAG = \"$VERSION_TAG\";
      static readonly VERSION_WITH_TAG = \"$VERSION_WITH_TAG\";
      static readonly VERSION_ENVIRONMENT = \"$VERSION_ENVIRONMENT\";
      static readonly SENTRY_RELEASE = \"release-$VERSION_WITH_TAG\";
    }
  " > ./keyman-version.mts

  # Generate version.inc.ts -- used by TypeScript code that isn't yet modular
  echo "
    // Generated by common/web/keyman-version/build.sh
    namespace com.keyman {
      export class KEYMAN_VERSION {
        static readonly VERSION = \"$VERSION\";
        static readonly VERSION_RELEASE =\"$VERSION_RELEASE\";
        static readonly VERSION_MAJOR = \"$VERSION_MAJOR\";
        static readonly VERSION_MINOR = \"$VERSION_MINOR\";
        static readonly VERSION_PATCH = \"$VERSION_PATCH\";
        static readonly TIER =\"$TIER\";
        static readonly VERSION_TAG = \"$VERSION_TAG\";
        static readonly VERSION_WITH_TAG = \"$VERSION_WITH_TAG\";
        static readonly VERSION_ENVIRONMENT = \"$VERSION_ENVIRONMENT\";
        static readonly VERSION_GIT_TAG = \"$VERSION_GIT_TAG\";
      }
    }
  " > ./version.inc.ts

  # Note: in a dependency build, we'll expect keyman-version to be built by tsc -b
  if builder_is_dep_build; then
    builder_echo "skipping tsc -b; will be completed by $builder_dep_parent"
  else
    echo 'Building @keymanapp/keyman-version'
    tsc -b $builder_verbose
  fi

  builder_finish_action success build
fi

if builder_start_action publish; then
  . "$KEYMAN_ROOT/resources/build/build-utils-ci.inc.sh"
  builder_publish_to_npm
  builder_finish_action success publish
fi
