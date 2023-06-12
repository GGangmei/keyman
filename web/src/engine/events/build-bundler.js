/*
 * Note:  while this file is not meant to exist long-term, it provides a nice
 * low-level proof-of-concept for esbuild bundling of the various Web submodules.
 *
 * Add some extra code at the end of src/index.ts and run it to verify successful bundling!
 */

import esbuild from 'esbuild';


await esbuild.build({
  alias: {
    'tslib': '@keymanapp/tslib'
  },
  bundle: true,
  sourcemap: true,
  format: "esm",
  nodePaths: ['../../../../node_modules'],
  entryPoints: {
    'index': '../../../build/engine/events/obj/index.js',
  },
  external: ['fs', 'vm'],
  outdir: '../../../build/engine/events/lib/',
  outExtension: { '.js': '.mjs' },
  tsconfig: './tsconfig.json',
  target: "es5"
});
