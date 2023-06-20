/*
 * Note:  while this file is not meant to exist long-term, it provides a nice
 * low-level proof-of-concept for esbuild bundling of the various Web submodules.
 *
 * Add some extra code at the end of src/index.ts and run it to verify successful bundling!
 */

import esbuild from 'esbuild';
import { bundleObjEntryPoints, iifeConfiguration } from '../../../../common/web/es-bundling/build/index.mjs';

const moduleNames = ['kmwuibutton', 'kmwuifloat', 'kmwuitoggle', 'kmwuitoolbar'];
const modules = moduleNames.map((name) => `../../../build/app/ui/obj/${name}.js`);

await esbuild.build({
  ...iifeConfiguration,
  ...bundleObjEntryPoints('debug', ...modules),
  // `esbuild`'s sourcemap output puts relative paths to the original sources from the
  // directory of the build output.  The following keeps repo structure intact and
  // puts our code under a common 'namespace' of sorts.
  sourceRoot: '@keymanapp/keyman/web/build/app/ui/debug/',
});

await esbuild.build({
  ...iifeConfiguration,
  ...bundleObjEntryPoints('release', ...modules),
  minify: true,
  // `esbuild`'s sourcemap output puts relative paths to the original sources from the
  // directory of the build output.  The following keeps repo structure intact and
  // puts our code under a common 'namespace' of sorts.
  sourceRoot: '@keymanapp/keyman/web/build/app/ui/debug/',
});