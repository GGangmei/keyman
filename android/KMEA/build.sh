#!/usr/bin/env bash
# Build Keyman Engine Android using Keyman Web artifacts
#
# Abbreviations:
# KMA  - Keyman for Android
# KMEA - Keyman Engine for Android
# KMW  - Keyman Web

#set -x
set -eu

## START STANDARD BUILD SCRIPT INCLUDE
# adjust relative paths as necessary
THIS_SCRIPT="$(greadlink -f "${BASH_SOURCE[0]}" 2>/dev/null || readlink -f "${BASH_SOURCE[0]}")"
. "$(dirname "$THIS_SCRIPT")/../../resources/build/build-utils.sh"
## END STANDARD BUILD SCRIPT INCLUDE

. "$KEYMAN_ROOT/resources/shellHelperFunctions.sh"

# This script runs from its own folder
cd "$THIS_SCRIPT_PATH"

# ################################ Main script ################################

# Definition of global compile constants

DEBUG="debug"
RELEASE="release"


builder_describe "Builds Keyman Engine for Android (KMEA)." \
  "@../../web build" \
  "clean" \
  "configure" \
  "build" \
  "test             Runs lint and unit tests." \
  ":app             Builds KMEA"

builder_describe_outputs \
  build:app     ./app/build/outputs/aar/keyman-android.aar

builder_parse "$@"

#### Build



echo Build KMEA

#
# Prevents 'clear' on exit of mingw64 bash shell
#
SHLVL=0

# Path definitions

KMA_ROOT="$KEYMAN_ROOT/android"
KMW_ROOT="$KEYMAN_ROOT/web"
KMEA_ASSETS="$KMA_ROOT/KMEA/app/src/main/assets"
ARTIFACT="app-release.aar"

DEBUG_BUILD=false
#KMWFLAGS="build:embed"
KMW_CONFIG=release

# Parse args


# Local development optimization - cross-target Sentry uploading when requested
# by developer. As it's not CI, the Web artifacts won't exist otherwise...
# unless the developer manually runs the correct build configuration accordingly.
if [[ $VERSION_ENVIRONMENT == "local" ]] && [[ $UPLOAD_SENTRY == true ]]; then
    # TODO:  handle the -upload-sentry in its eventual new form
    KMWFLAGS="$KMWFLAGS -upload-sentry"
fi

#### Build action definitions ####

if builder_has_option --debug; then
  DEBUG_BUILD=true
  ARTIFACT="app-debug.aar"
fi

DAEMON_FLAG=
if builder_has_option --ci; then
  DAEMON_FLAG=--no-daemon
fi


if builder_start_action configure; then

  # Copy KeymanWeb artifacts
  echo "Copying KMW artifacts"
  cp $KMW_ROOT/build/app/embed/$KMW_CONFIG/osk/ajax-loader.gif $KMEA_ASSETS/ajax-loader.gif
  cp $KMW_ROOT/build/app/embed/$KMW_CONFIG/keyman.js $KMEA_ASSETS/keymanandroid.js
  cp $KMW_ROOT/build/app/embed/$KMW_CONFIG/keyman.js.map $KMEA_ASSETS/keyman.js.map
  cp $KMW_ROOT/build/app/embed/$KMW_CONFIG/osk/kmwosk.css $KMEA_ASSETS/kmwosk.css
  cp $KMW_ROOT/build/app/embed/$KMW_CONFIG/osk/globe-hint.css $KMEA_ASSETS/globe-hint.css
  cp $KMW_ROOT/build/app/embed/$KMW_CONFIG/osk/keymanweb-osk.ttf $KMEA_ASSETS/keymanweb-osk.ttf

  cp $KEYMAN_ROOT/common/web/sentry-manager/build/index.js $KMEA_ASSETS/keyman-sentry.js

  echo "Copying es6-shim polyfill"
  cp $KEYMAN_ROOT/node_modules/es6-shim/es6-shim.min.js $KMEA_ASSETS/es6-shim.min.js

  if [ $? -ne 0 ]; then
    die "ERROR: copying artifacts failed"
  fi

  # Cursory check that KMW exists
  if [ ! -f "$KMEA_ASSETS/keymanandroid.js" ]; then
    die "ERROR: keymanweb not built"
  fi

  builder_finish_action success configure
fi

echo
echo "DEBUG_BUILD: $DEBUG_BUILD"
echo

if builder_start_action clean:app; then
  if [ -f "$KMA_ROOT/KMEA/app/build/outputs/aar/$ARTIFACT" ]; then
    rm -f "$KMA_ROOT/KMEA/app/build/outputs/aar/$ARTIFACT"
    echo "Cleaned $ARTIFACT"
  else
    echo "Nothing to clean"
  fi

  builder_finish_action success clean:app
fi


# Destinations that will need the keymanweb artifacts


if builder_start_action build:app; then
  echo "Gradle Build of KMEA"
  cd $KMA_ROOT/KMEA

  if [ "$DEBUG_BUILD" = true ]; then
    BUILD_FLAGS="assembleDebug -x lintDebug -x test"
    ARTIFACT="app-debug.aar"
  else
    BUILD_FLAGS="aR -x lint -x test"
    ARTIFACT="app-release.aar"
  fi

  echo "BUILD_FLAGS $BUILD_FLAGS"
  # Build without test
  ./gradlew $DAEMON_FLAG clean $BUILD_FLAGS
  if [ $? -ne 0 ]; then
    die "ERROR: Build of KMEA failed"
  fi

  builder_finish_action success build:app
fi

if builder_start_action test:app; then
  echo "Gradle test of KMEA"
  cd $KMA_ROOT/KMEA

  if [ "$DEBUG_BUILD" = true ]; then
    TEST_FLAGS="-x assembleDebug lintDebug testDebug"
    ARTIFACT="app-debug.aar"
    if builder_has_option --ci; then
      # Report JUnit test results to CI
      echo "##teamcity[importData type='junit' path='keyman\android\KMEA\app\build\test-results\testDebugUnitTest\']"
    fi
  else
    TEST_FLAGS="-x aR lint testRelease"
    ARTIFACT="app-release.aar"
    if builder_has_option --ci; then
      # Report JUnit test results to CI
      echo "##teamcity[importData type='junit' path='keyman\android\KMEA\app\build\test-results\testReleaseUnitTest\']"
    fi
  fi

  echo "TEST_FLAGS $TEST_FLAGS"
  ./gradlew $DAEMON_FLAG $TEST_FLAGS
  if [ $? -ne 0 ]; then
    die "ERROR: KMEA test cases failed"
  fi

  builder_finish_action success test:app
fi

function _copy_artifacts() {
  echo "Copying Keyman Engine for Android to KMAPro, Sample apps, and Tests"
  mv $KMA_ROOT/KMEA/app/build/outputs/aar/$ARTIFACT $KMA_ROOT/KMAPro/kMAPro/libs/keyman-engine.aar
  cp $KMA_ROOT/KMAPro/kMAPro/libs/keyman-engine.aar $KMA_ROOT/Samples/KMSample1/app/libs/keyman-engine.aar
  cp $KMA_ROOT/KMAPro/kMAPro/libs/keyman-engine.aar $KMA_ROOT/Samples/KMSample2/app/libs/keyman-engine.aar
  cp $KMA_ROOT/KMAPro/kMAPro/libs/keyman-engine.aar $KMA_ROOT/Tests/KeyboardHarness/app/libs/keyman-engine.aar
  if [ ! -z ${RELEASE_OEM+x} ]; then
    cp $KMA_ROOT/KMAPro/kMAPro/libs/keyman-engine.aar $KMA_ROOT/../oem/firstvoices/android/app/libs/keyman-engine.aar
  fi
  cd ..\
}

# TODO: why do we need this extra brace?
}