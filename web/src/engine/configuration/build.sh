#!/usr/bin/env bash
#

# set -x
set -eu

## START STANDARD BUILD SCRIPT INCLUDE
# adjust relative paths as necessary
THIS_SCRIPT="$(readlink -f "${BASH_SOURCE[0]}")"
. "${THIS_SCRIPT%/*}/../../../../resources/build/build-utils.sh"
## END STANDARD BUILD SCRIPT INCLUDE

. "$KEYMAN_ROOT/resources/shellHelperFunctions.sh"

# This script runs from its own folder
cd "$THIS_SCRIPT_PATH"

# Imports common Web build-script definitions & functions
SUBPROJECT_NAME=engine/configuration
. "$KEYMAN_ROOT/web/common.inc.sh"

# ################################ Main script ################################

builder_describe "Builds configuration subclasses used by the Keyman Engine for Web (KMW)." \
  "@/common/web/keyboard-processor build" \
  "@../device-detect build" \
  "clean" \
  "configure" \
  "build" \
  "test"

# Possible TODO?s
# "upload-symbols   Uploads build product to Sentry for error report symbolification.  Only defined for $DOC_BUILD_EMBED_WEB" \

builder_describe_outputs \
  configure    /node_modules \
  build        /web/build/$SUBPROJECT_NAME/obj/index.js

builder_parse "$@"

#### Build action definitions ####

if builder_start_action configure; then
  verify_npm_setup

  builder_finish_action success configure
fi

if builder_start_action clean; then
  rm -rf "$KEYMAN_ROOT/web/build/$SUBPROJECT_NAME"
  builder_finish_action success clean
fi

if builder_start_action build; then
  compile $SUBPROJECT_NAME

  builder_finish_action success build
fi

if builder_start_action test; then
  # TODO:  CI vs manual:  how the tests are reported.
  npm run mocha -- --recursive src/test/auto/headless/configuration
  builder_finish_action success test
fi