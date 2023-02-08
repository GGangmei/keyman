/*
 * Note:  while this file is not meant to exist long-term, it provides a nice
 * low-level proof-of-concept for esbuild bundling of the various Web submodules.
 *
 * Add some extra code at the end of src/index.ts and run it to verify successful bundling!
 */

import esbuild from 'esbuild';
import { spawn } from 'child_process';

/** @type {esbuild.BuildOptions} */
const commonConfig = {
  bundle: true,
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  target: 'es5',
  // Sets 'common/web' as a root folder for module resolution;
  // this allows the keyman-version and utils imports to resolve.
  //
  // We also need to point it at the nested build output folder to resolve in-project
  // imports when compiled - esbuild doesn't seem to pick up on the shifted base.
  nodePaths: ['..', "build/obj"]
};

// Bundled ES module version
esbuild.buildSync({
  entryPoints: ['build/obj/index.js'],
  outfile: "build/lib/index.mjs",
  format: "esm",
  ...commonConfig
});

// Bundled CommonJS (classic Node) module version
esbuild.buildSync({
  entryPoints: ['build/obj/index.js'],
  outfile: 'build/lib/index.cjs',
  format: "cjs",
  ...commonConfig
});


esbuild.buildSync({
  entryPoints: ['build/obj/keyboards/loaders/domKeyboardLoader.js'],
  outfile: 'build/lib/keyboards/loaders/domKeyboardLoader.mjs',
  format: "esm",
  ...commonConfig
});

// The node-based keyboard loader needs an extra parameter due to Node-built-in imports:
esbuild.buildSync({
  entryPoints: ['build/obj/keyboards/loaders/nodeKeyboardLoader.js'],
  outfile: 'build/lib/keyboards/loaders/nodeKeyboardLoader.mjs',
  format: "esm",
  platform: "node",
  ...commonConfig
});