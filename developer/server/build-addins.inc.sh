#!/usr/bin/env bash

# This script is used by build.sh

isFileX64() {
  [[ $(file -b "$1" | grep x86-64) ]] && echo 1 || echo 0
}

isNodeX64() {
  isFileX64 "$(which node)"
  # [[ $(file -b "$(which node)" | grep x86-64) ]] && echo 1 || echo 0
}

build_addins() {
  local NODEX64=$(isNodeX64)
  local ARCH=x64
  local TRAYICON_TARGET=addon.x64.node
  local HIDECONSOLE_TARGET=node-hide-console-window.x64.node
  echo "Building addins with $(which node)"

  if (( ! NODEX64 )); then
    ARCH=ia32
    TRAYICON_TARGET=addon.node
    HIDECONSOLE_TARGET=node-hide-console-window.node
  fi

  echo "NODEX64=$NODEX64"
  echo "ARCH=$ARCH"
  echo "TRAYICON_TARGET=$TRAYICON_TARGET"
  echo "HIDECONSOLE_TARGET=$HIDECONSOLE_TARGET"

  HIDECONSOLE_TARGET="$KEYMAN_ROOT/developer/server/src/win32/console/$HIDECONSOLE_TARGET"
  TRAYICON_TARGET="$KEYMAN_ROOT/developer/server/src/win32/trayicon/$TRAYICON_TARGET"

  #
  # Build node-windows-trayicon
  #

  pushd "$KEYMAN_ROOT/developer/server/win32/node-windows-trayicon"
  rm -rf node_modules
  rm -rf build
  npm install --arch=$ARCH --silent
  cp build/Release/addon.node "$TRAYICON_TARGET"
  popd

  #
  # Build hetrodo-node-hide-console-window-napi
  #

  pushd "$KEYMAN_ROOT/developer/server/win32/hetrodo-node-hide-console-window-napi"
  rm -rf node_modules
  rm -rf build
  npm install --arch=$ARCH --silent
  cp build/Release/node-hide-console-window.node "$HIDECONSOLE_TARGET"
  popd

  #
  # Sanity check
  #

  if (( NODEX64 )); then
    [[ $(isFileX64 "$TRAYICON_TARGET") == 1 ]] || die "$TRAYICON_TARGET should be 64-bit"
    [[ $(isFileX64 "$HIDECONSOLE_TARGET") == 1 ]] || die "$HIDECONSOLE_TARGET should be 64-bit"
  else
    [[ $(isFileX64 "$TRAYICON_TARGET") == 0 ]] || die "$TRAYICON_TARGET should not be 64-bit"
    [[ $(isFileX64 "$HIDECONSOLE_TARGET") == 0 ]] || die "$HIDECONSOLE_TARGET should not be 64-bit"
  fi
}
