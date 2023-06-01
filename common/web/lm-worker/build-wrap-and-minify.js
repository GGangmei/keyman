import fs from 'fs';
import esbuild from 'esbuild';

import convertSourcemap from 'convert-source-map'; // Transforms sourcemaps among various common formats.
                                                   // Base64, stringified-JSON, end-of-file comment...

let DEBUG = false;
let MINIFY = false;

if(process.argv.length > 2) {
  for(let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    switch(arg) {
      case '--debug':
        DEBUG = true;
        break;
      case '--minify':
        MINIFY = true;
        break;
      // May add other options if desired in the future.
      default:
        console.error("Invalid command-line option set for script; only --debug and --minify are permitted.");
        process.exit(1);
    }
  }
}

let sourcemapJSON = '';

if(MINIFY) {
  await esbuild.build({
    entryPoints: [`build/lib/worker-main.polyfilled.js`],
    sourcemap: 'external',
    sourcesContent: DEBUG,
    minify: MINIFY,
    keepNames: true,
    outfile: `build/lib/worker-main.polyfilled.min.js`
  });
}

sourcemapJSON = convertSourcemap.fromJSON(fs.readFileSync(`build/lib/worker-main.polyfilled${MINIFY ? '.min' : ''}.js.map`)).toObject();

const workerConcatenation = {
  script: fs.readFileSync(`build/lib/worker-main.polyfilled${MINIFY ? '.min' : ''}.js`),
  sourcemapJSON: sourcemapJSON
}

// While it IS possible to do partial sourcemaps (without the sources, but with everything else) within the worker...
// the resulting sourcemaps are -surprisingly- large - larger than the code itself!
//
// So... we don't use that strategy here.

console.log();
console.log(`Wrapping + generating final output: ${MINIFY ? 'minified' : 'unminified'} + ${DEBUG ? 'full sourcemaps' : 'reduced sourcemaps'}`);

// Now, to build the wrapper...

// First, let's build the encoded sourcemap.
const encodedSrcMap = convertSourcemap.fromObject(workerConcatenation.sourcemapJSON).toBase64();
const srcMapString = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${encodedSrcMap}`;

/*
 * It'd be nice to do a 'partial' encodeURIComponent that only gets the important bits...
 * but my attempts to do so end up triggering errors when loading.
 */

let rawScript = workerConcatenation.script.toString();
// Two layers of encoding:  one for the raw source (parsed by the JS engine),
// one to 'unwrap' it from a string _within_ that source.
let jsonDoubleEncoded = JSON.stringify(JSON.stringify(rawScript));

let wrapper = `
// Autogenerated code.  Do not modify!
// --START:LMLayerWorkerCode--

export var LMLayerWorkerCode = ${jsonDoubleEncoded};

${MINIFY && "// Sourcemaps have been omitted for this release build."}
export var LMLayerWorkerSourcemapComment = "${DEBUG ? srcMapString : ''}";

// --END:LMLayerWorkerCode
`;

fs.writeFileSync(`build/lib/worker-main.wrapped${MINIFY ? '.min' : ''}.js`, wrapper);