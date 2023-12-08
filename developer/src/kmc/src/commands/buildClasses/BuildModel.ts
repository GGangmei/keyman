import { BuildActivity } from './BuildActivity.js';
import { LexicalModelCompiler } from '@keymanapp/kmc-model';
import { CompilerCallbacks, CompilerOptions, KeymanFileTypes } from '@keymanapp/common-types';

export class BuildModel extends BuildActivity {
  public get name(): string { return 'Lexical model'; }
  public get sourceExtension(): KeymanFileTypes.Source { return KeymanFileTypes.Source.Model; }
  public get compiledExtension(): KeymanFileTypes.Binary { return KeymanFileTypes.Binary.Model; }
  public get description(): string { return 'Build a lexical model'; }
  public async build(infile: string, callbacks: CompilerCallbacks, options: CompilerOptions): Promise<boolean> {
    const outputFilename: string = this.getOutputFilename(infile, options);

    const compiler = new LexicalModelCompiler();
    if(!await compiler.init(callbacks, options)) {
      return false;
    }

    const result = await compiler.run(infile, outputFilename);
    if(!result) {
      return false;
    }

    return await compiler.write(result.artifacts);
  }
}