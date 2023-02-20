#!/usr/bin/env bash
#
# Compiles the Language Modeling Layer for common use in predictive text and autocorrective applications.
# Designed for optimal compatibility with the Keyman Suite.
#

# Exit on command failure and when using unset variables:
set -eu

# Include some helper functions from resources

## START STANDARD BUILD SCRIPT INCLUDE
# adjust relative paths as necessary
THIS_SCRIPT="$(greadlink -f "${BASH_SOURCE[0]}" 2>/dev/null || readlink -f "${BASH_SOURCE[0]}")"
. "$(dirname "$THIS_SCRIPT")/../../../resources/build/build-utils.sh"
## END STANDARD BUILD SCRIPT INCLUDE

. "$KEYMAN_ROOT/resources/shellHelperFunctions.sh"

# This script runs from its own folder
cd "$(dirname "$THIS_SCRIPT")"

WORKER_OUTPUT=build
WORKER_OUTPUT_FILENAME=$WORKER_OUTPUT/index.js
WORKER_TEST_BUNDLE_TARGET_FILENAME=$WORKER_OUTPUT/index.wrapped-for-bundle.ts

# Wraps JavaScript code in a way that can be embedded in a worker.
# To get the inner source code, include the file generated by this function,
# then use name.toString() where `name` is the name passed into this
# function.
wrap-worker-code ( ) {
  name="$1"
  js="$2"
  # Reference: https://stackoverflow.com/a/59046041
  # Use of this annotation allows us to actually build against the file, rather
  # than hackily insert it later when/where needed.
  echo "// @ts-nocheck"
  echo "// Autogenerated code. Do not modify!"
  echo "// --START:LMLayerWorkerCode--"
  printf "function %s () {\n" "${name}"

  # Since the worker is compiled with "allowJS=false" so that we can make
  # declaration files, we have to insert polyfills here.

  ### NOTE ###
  # Android API 21 (our current minimum) released with Chrome for Android 37.
  # It's also updatable as of this version, but we can't guarantee that the user
  # actually updated it, especially on first launch of the Android app/keyboard.

  # This one's a minimal, targeted polyfill.  es6-shim could do the same,
  # but also adds a lot more code the worker doesn't need to use.
  # Recommended by MDN while keeping the worker lean and efficient.
  # Needed for Android / Chromium browser pre-41.
  cat "../../../node_modules/string.prototype.codepointat/codepointat.js" || builder_die

  # These two are straight from MDN - I didn't find any NPM ones that don't
  # use the node `require` statement for the second.  They're also relatively
  # short and simple, which is good.
  cat "src/polyfills/array.fill.js" || builder_die # Needed for Android / Chromium browser pre-45.
  cat "src/polyfills/array.findIndex.js" || builder_die # Needed for Android / Chromium browser pre-45.
  cat "src/polyfills/array.from.js" || builder_die # Needed for Android / Chromium browser pre-45.
  cat "src/polyfills/array.includes.js" || builder_die # Needed for Android / Chromium browser pre-47.

  # For Object.values, for iteration over object-based associate arrays.
  cat "src/polyfills/object.values.js" || builder_die # Needed for Android / Chromium browser pre-54.

  # Needed to support Symbol.iterator, as used by the correction algorithm.
  cat "src/polyfills/symbol-es6.min.js" || builder_die # Needed for Android / Chromium browser pre-43.

  echo ""

  cat "${js}" || builder_die
  printf "\n}\n"
  echo "// --END:LMLlayerWorkerCode"
}

################################ Main script ################################

builder_describe \
  "Compiles the Language Modeling Layer for common use in predictive text and autocorrective applications." \
  "@../keyman-version" \
  configure clean build test

builder_describe_outputs \
  configure     /node_modules \
  build         build/index.js

builder_parse "$@"

# TODO: build if out-of-date if test is specified
# TODO: configure if npm has not been run, and build is specified

if builder_start_action configure; then
  verify_npm_setup
  builder_finish_action success configure
fi

# We always need to clean first because the wrapping function
# breaks the typescript build, as it makes the index.tsbuildinfo file
# inconsistent with the actual index.js and causes the file to be
# corrupted on subsequent builds. In order to use the --build parameter
# of typescript, we need to avoid this!
# TODO: we should try and rework this to avoid the need to manually wrap

if builder_start_action clean; then
  npm run clean
  builder_finish_action success clean
fi

if builder_start_action build; then
  if ! builder_has_action clean; then
    npm run clean
  fi

  # Build worker with tsc first
  npm run build -- $builder_verbose || fail "Could not build worker."

  # Wrap the worker code and create embedded index.js. Must be run after the
  # worker is built
  echo "Wrapping worker in function LMLayerWorkerCode ${WORKER_OUTPUT_FILENAME}"
  # Note: We use intermediate.js for unit tests in predictive-text
  cp "${WORKER_OUTPUT_FILENAME}" "${WORKER_OUTPUT}/intermediate.js"
  wrap-worker-code LMLayerWorkerCode "${WORKER_OUTPUT}/intermediate.js" > "${WORKER_OUTPUT_FILENAME}" || builder_die
  cp "${WORKER_OUTPUT_FILENAME}" "${WORKER_TEST_BUNDLE_TARGET_FILENAME}" || builder_die

  builder_finish_action success build
fi

if builder_start_action test; then
  npm test || fail "Tests failed"
  builder_finish_action success test
fi
