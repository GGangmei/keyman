#!/usr/bin/env bash
# Build Keyman Engine for Android using Keyman Web artifacts
#

#set -x
set -eu

## START STANDARD BUILD SCRIPT INCLUDE
# adjust relative paths as necessary
THIS_SCRIPT="$(readlink -f "${BASH_SOURCE[0]}")"
. "${THIS_SCRIPT%/*}/../../resources/build/build-utils.sh"
## END STANDARD BUILD SCRIPT INCLUDE

. "$KEYMAN_ROOT/resources/shellHelperFunctions.sh"

# This script runs from its own folder
cd "$THIS_SCRIPT_PATH"

# ################################ Main script ################################

# Definition of global compile constants

KEYMAN_ANDROID_ROOT="$KEYMAN_ROOT/android"
KEYMAN_WEB_ROOT="$KEYMAN_ROOT/web"
ENGINE_ASSETS="$KEYMAN_ANDROID_ROOT/KMEA/app/src/main/assets"
CONFIG="release"
BUILD_FLAGS="aR -x lint -x test"           # Gradle build w/o test
TEST_FLAGS="-x aR lintRelease testRelease" # Gradle test w/o build
JUNIT_RESULTS="##teamcity[importData type='junit' path='keyman\android\KMEA\app\build\test-results\testReleaseUnitTest\']"

builder_describe "Builds Keyman Engine for Android." \
  "@../../web" \
  "clean" \
  "configure" \
  "build" \
  "test             Runs lint and unit tests." \
  ":engine          Builds Engine" \
  "--ci             Don't start the Gradle daemon. For CI"

# parse before describe_outputs to check debug flags
builder_parse "$@"

if builder_has_option --debug; then
  builder_heading "### Debug config ####"
  CONFIG="debug"
  BUILD_FLAGS="assembleDebug -x lint -x test"
  TEST_FLAGS="-x assembleDebug lintDebug testDebug"
  JUNIT_RESULTS="##teamcity[importData type='junit' path='keyman\android\KMEA\app\build\test-results\testDebugUnitTest\']"
fi

ARTIFACT="app-$CONFIG.aar" # Note: dependants will use keyman-engine.aar

builder_describe_outputs \
  build:engine     ./app/build/outputs/aar/${ARTIFACT}

#### Build

#
# Prevents 'clear' on exit of mingw64 bash shell
#
SHLVL=0


# Parse args

DAEMON_FLAG=
if builder_has_option --ci; then
  DAEMON_FLAG=--no-daemon
fi

#### Build action definitions ####

# Check about cleaning arifact paths and upload directories
if builder_start_action clean:engine; then
  cd "$KEYMAN_ROOT/android/KMEA/"

  if [ -d "$KEYMAN_ROOT/android/KMEA/app/build/outputs" ]; then
    rm -rf "$KEYMAN_ROOT/android/KMEA/app/build/outputs"
  fi  

  if [ -d "$KEYMAN_ROOT/android/upload" ]; then
    rm -rf "$KEYMAN_ROOT/android/upload"
  fi

  builder_finish_action success clean:engine
fi

if builder_start_action configure; then

  # Copy KeymanWeb artifacts
  echo "Copying Keyman Web artifacts"
  cp $KEYMAN_WEB_ROOT/build/app/embed/$CONFIG/osk/ajax-loader.gif $ENGINE_ASSETS/ajax-loader.gif
  cp $KEYMAN_WEB_ROOT/build/app/embed/$CONFIG/keyman.js $ENGINE_ASSETS/keymanandroid.js
  cp $KEYMAN_WEB_ROOT/build/app/embed/$CONFIG/keyman.js.map $ENGINE_ASSETS/keyman.js.map
  cp $KEYMAN_WEB_ROOT/build/app/embed/$CONFIG/osk/kmwosk.css $ENGINE_ASSETS/kmwosk.css
  cp $KEYMAN_WEB_ROOT/build/app/embed/$CONFIG/osk/globe-hint.css $ENGINE_ASSETS/globe-hint.css
  cp $KEYMAN_WEB_ROOT/build/app/embed/$CONFIG/osk/keymanweb-osk.ttf $ENGINE_ASSETS/keymanweb-osk.ttf

  cp $KEYMAN_ROOT/common/web/sentry-manager/build/index.js $ENGINE_ASSETS/keyman-sentry.js

  echo "Copying es6-shim polyfill"
  cp $KEYMAN_ROOT/node_modules/es6-shim/es6-shim.min.js $ENGINE_ASSETS/es6-shim.min.js

  builder_finish_action success configure
fi

# Destinations that will need the keymanweb artifacts


if builder_start_action build:engine; then
  cd "$KEYMAN_ANDROID_ROOT/KMEA"

  echo "BUILD_FLAGS $BUILD_FLAGS"
  # Build without test
  ./gradlew $DAEMON_FLAG clean $BUILD_FLAGS

  # Copy ARTIFACT to "keyman-engine.aar"
  cp "$KEYMAN_ROOT/android/kmea/app/build/outputs/aar/${ARTIFACT}" "$KEYMAN_ROOT/android/kmea/app/build/outputs/aar/keyman-engine.aar"

  builder_finish_action success build:engine
fi

if builder_start_action test:engine; then
  cd "$KEYMAN_ANDROID_ROOT/KMEA"

  if builder_has_option --ci; then
    # Report JUnit test results to CI
    echo "$JUNIT_RESULTS"
  fi

  echo "TEST_FLAGS: $TEST_FLAGS"
  ./gradlew $DAEMON_FLAG $TEST_FLAGS

  builder_finish_action success test:engine
fi
