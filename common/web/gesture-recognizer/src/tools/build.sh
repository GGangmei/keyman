#!/usr/bin/env bash
#
# Builds the include script for the current Keyman version.
#

# Exit on command failure and when using unset variables:
set -eu

## START STANDARD BUILD SCRIPT INCLUDE
# adjust relative paths as necessary
THIS_SCRIPT="$(greadlink -f "${BASH_SOURCE[0]}" 2>/dev/null || readlink -f "${BASH_SOURCE[0]}")"
. "$(dirname "$THIS_SCRIPT")/../../../../../resources/build/build-utils.sh"
## END STANDARD BUILD SCRIPT INCLUDE

. "$KEYMAN_ROOT/resources/shellHelperFunctions.sh"

# This script runs from its own folder
cd "$(dirname $THIS_SCRIPT)"

################################ Main script ################################

builder_describe "Testing-oriented tools for the Gesture Recognizer module of web-based Keyman OSKs" \
  "clean" \
  "build" \
  ":fixture The HTML-element fixture and CSS fixture used for both user-testing and unit-testing" \
  ":recorder The web page used for recording input sequences for use in unit-testing" \
  ":test-module The TS library used to interface with the main gesture-recognizer module for tests"

builder_parse "$@"

# TODO: build if out-of-date if test is specified
# TODO: configure if npm has not been run, and build is specified

if builder_has_action clean :recorder; then
  rm -rf ./recorder/build
  builder_report success clean :recorder
fi

if builder_has_action clean :fixture; then
  rm -f ../../build/tools/host-fixture.html
  rm -f ../../build/tools/gestureHost.css
  builder_report success clean :fixture
fi

if builder_has_action clean :test-module; then
  rm -rf ../../build/tools/*.ts*
  rm -rf ../../build/tools/*.js*
  builder_report success clean :test-module
fi

if builder_has_action build :fixture; then
  if [ ! -d ../../build/tools ]; then
    mkdir -p ../../build/tools
  fi
  ./host-fixture/extract-fixture.sh > ../../build/tools/host-fixture.html
  cp ./host-fixture/gestureHost.css ../../build/tools/gestureHost.css
  builder_report success build :fixture
fi

if builder_has_action build :recorder; then
  if [ ! -d recorder/build ]; then
    mkdir -p recorder/build
  fi
  cp recorder/src/pageStyle.css    recorder/build/pageStyle.css
  cp recorder/src/recorder.js      recorder/build/recorder.js

  cp host-fixture/gestureHost.css  recorder/build/gestureHost.css

  # Thanks to https://stackoverflow.com/a/10107668 for this tidbit.
  # Searches for FIXTURE_TARGET above and replaces it with the actual fixture!
  pushd recorder >/dev/null
  node update-index.js build/index.html
  popd >/dev/null
  builder_report success build :recorder
fi

if builder_has_action build :test-module; then
  npm run tsc -- -b "$(dirname $THIS_SCRIPT)/unit-test-resources/tsconfig.json"
  builder_report success build :test-module
fi