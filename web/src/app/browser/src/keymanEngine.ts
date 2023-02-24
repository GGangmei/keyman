import { KeymanEngine as KeymanEngineBase } from 'keyman/engine/main';
import { ProcessorInitOptions } from "@keymanapp/keyboard-processor";
import { Configuration } from "keyman/engine/configuration";

import ContextManager from './contextManager.js';
import DefaultOutput from './defaultOutput.js';

export class KeymanEngine extends KeymanEngineBase<ContextManager, never /* Not yet implemented */> {
  constructor(config: Configuration) {
    super(config, new ContextManager());
  }

  protected processorConfiguration(): ProcessorInitOptions {
    return {
      keyboardInterface: this.interface,
      defaultOutputRules: new DefaultOutput(this.contextManager)
    };
  };
}
