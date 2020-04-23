/*
  lexical-model-compiler.ts: base file for lexical model compiler.
*/

/// <reference path="./lexical-model.ts" />
/// <reference path="./model-info-file.ts" />

import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";
import { createTrieDataStructure, defaultSearchTermToKey } from "./build-trie";

export default class LexicalModelCompiler {

  /**
   * Returns the generated code for the model that will ultimately be loaded by
   * the LMLayer worker. This code contains all model parameters, and specifies
   * word breakers and auxilary functions that may be required.
   *
   * @param model_id      The model ID. TODO: not sure if this is actually required!
   * @param modelSource   A specification of the model to compile
   * @param sourcePath    Where to find auxilary sources files
   */
  generateLexicalModelCode(model_id: string, modelSource: LexicalModelSource, sourcePath: string) {
    // TODO: add metadata in comment
    const filePrefix: string = `(function() {\n'use strict';\n`;
    const fileSuffix: string = `})();`;
    let func = filePrefix;

    //
    // Emit the model as code and data
    //

    switch(modelSource.format) {
      case "custom-1.0":
        let sources: string[] = modelSource.sources.map(function(source) {
          return fs.readFileSync(path.join(sourcePath, source), 'utf8');
        });
        func += this.transpileSources(sources).join('\n');
        func += `LMLayerWorker.loadModel(new ${modelSource.rootClass}());\n`;
        break;
      case "fst-foma-1.0":
        throw new ModelSourceError(`Unimplemented model format: ${modelSource.format}`);
      case "trie-1.0":
        // Convert all relative path names to paths relative to the enclosing
        // directory. This way, we'll read the files relative to the model.ts
        // file, rather than the current working directory.
        let filenames = modelSource.sources.map(filename => path.join(sourcePath, filename));

        // Use the default search term to key function, if left unspecified.
        let searchTermToKey = modelSource.searchTermToKey || defaultSearchTermToKey;

        func += `LMLayerWorker.loadModel(new models.TrieModel(${
          createTrieDataStructure(filenames, searchTermToKey)
        }, {\n`;


        let wordBreakerSourceCode = compileWordBreaker(modelSource.wordBreaker);
        func += `  wordBreaker: ${wordBreakerSourceCode},\n`;

        func += `  searchTermToKey: ${searchTermToKey.toString()},\n`;

        if (modelSource.punctuation) {
          func += `  punctuation: ${JSON.stringify(modelSource.punctuation)},\n`;
        }
        func += `}));\n`;
        break;
      default:
        throw new ModelSourceError(`Unknown model format: ${modelSource.format}`);
    }

    //
    // TODO: Load custom wordbreak source files
    //

    func += fileSuffix;

    return func;
  }

  transpileSources(sources: Array<string>): Array<string> {
    return sources.map((source) => ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.None }
      }).outputText
    );
  };

  logError(s: string) {
    console.error(require('chalk').red(s));
  };
};

export class ModelSourceError extends Error {
}

/**
 * Returns a JavaScript expression (as a string) that can serve as a word
 * breaking function.
 */
function compileWordBreaker(wordBreakerSpec: WordBreakerSpec | SimpleWordBreakerSpec) {
  // Use the default word breaker when it's unspecified
  let spec_ = normalizeWordBreakerSpec(wordBreakerSpec);

  if (typeof spec_.use === "string") {
    // It must be a builtin word breaker, so just instantiate it.
    return `wordBreakers['${wordBreakerSpec}']`;
  } else {
    return wordBreakerSpec.toString()
      // Note: the .toString() might just be the property name, but we want a
      // plain function:
      .replace(/^wordBreak(ing|er)\b/, 'function');
  }
}
function normalizeWordBreakerSpec(wordBreakerSpec: WordBreakerSpec | SimpleWordBreakerSpec): WordBreakerSpec {
  if (!wordBreakerSpec) {
    return { use: 'default' };
  } else if (wordBreakerSpec === "default" || wordBreakerSpec === 'ascii') {
    return { use: wordBreakerSpec };
  } else if (typeof wordBreakerSpec === "function") {
    // The word breaker was passed as a literal function; use its source code.
    return { use: wordBreakerSpec };
  } else if (wordBreakerSpec.use) {
    return wordBreakerSpec;
  } else {
    throw new Error(`Unknown word breaker: ${wordBreakerSpec}`);
  }
}

