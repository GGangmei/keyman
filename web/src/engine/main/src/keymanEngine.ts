import { DefaultRules, type Keyboard, KeyboardKeymanGlobal, ProcessorInitOptions } from "@keymanapp/keyboard-processor";
import { DOMKeyboardLoader as KeyboardLoader } from "@keymanapp/keyboard-processor/dom-keyboard-loader";
import { InputProcessor, PredictionContext } from "@keymanapp/input-processor";
import { OSKView } from "keyman/engine/osk";
import { KeyboardRequisitioner, type KeyboardStub, ModelCache, ModelSpec } from "keyman/engine/package-cache";

import { EngineConfiguration, InitOptionSpec } from "./engineConfiguration.js";
import KeyboardInterface from "./keyboardInterface.js";
import { ContextManagerBase } from "./contextManagerBase.js";
import { KeyEventHandler } from './keyEventSource.interface.js';
import HardKeyboardBase from "./hardKeyboard.js";
import { LegacyAPIEventEngine } from "./legacyAPIEvents.js";
import DOMCloudRequester from "keyman/engine/package-cache/dom-requester";

export default class KeymanEngine<
  ContextManager extends ContextManagerBase,
  HardKeyboard extends HardKeyboardBase
> implements KeyboardKeymanGlobal {
  readonly config: EngineConfiguration;
  readonly contextManager: ContextManager;
  readonly interface: KeyboardInterface;
  readonly processor: InputProcessor;
  readonly keyboardRequisitioner: KeyboardRequisitioner;
  readonly modelCache: ModelCache;

  private legacyAPIEvents = new LegacyAPIEventEngine();
  private _hardKeyboard: HardKeyboard;
  private _osk: OSKView;

  private keyEventListener: KeyEventHandler = (event, callback) => {
    const outputTarget = this.contextManager.activeTarget;

    if(!this.contextManager.activeKeyboard || !outputTarget) {
      if(callback) {
        callback(null, null);
      }
    }

    //... probably only applies for physical keystrokes.
    if(!event.isSynthetic) {
      if(this.osk?.vkbd?.keyPending) {
        this.osk.vkbd.keyPending = null;
      }
    } else {
      // Do anything needed to guarantee that the outputTarget stays active (`browser`: maintains focus).
    }

    try {
      // Clear any cached codepoint data; we can rebuild it if it's unchanged.
      outputTarget.invalidateSelection();
      // Deadkey matching continues to be troublesome.
      // Deleting matched deadkeys here seems to correct some of the issues.   (JD 6/6/14)
      outputTarget.deadkeys().deleteMatched();      // Delete any matched deadkeys before continuing

      const result = this.processor.processKeyEvent(event, outputTarget);
      if(callback) {
        callback(result, null);
      }
    } catch (err) {
      if(callback) {
        callback(null, err);
      }
    }
  };

  // Should be overwritten as needed by engine subclasses; `browser` should set its DefaultOutput subclass in place.
  protected processorConfiguration(): ProcessorInitOptions {
    return {
      keyboardInterface: this.interface,
      defaultOutputRules: new DefaultRules()
    };
  };

  //

  /**
   * @param worker  A configured WebWorker to serve as the predictive-text engine's main thread.
   *                Available in the following variants:
   *                - sourcemapped, unminified (debug)
   *                - non-sourcemapped + minified (release)
   * @param config
   * @param contextManager
   */
  constructor(worker: Worker, config: EngineConfiguration, contextManager: ContextManager) {
    this.config = config;
    this.contextManager = contextManager;

    // Since we're not sandboxing keyboard loads yet, we just use `window` as the jsGlobal object.
    this.interface = new KeyboardInterface(window, this, this.contextManager, config.stubNamespacer);
    const keyboardLoader = new KeyboardLoader(this.interface, config.applyCacheBusting);
    this.keyboardRequisitioner = new KeyboardRequisitioner(keyboardLoader, new DOMCloudRequester(), this.config.paths);
    this.modelCache = new ModelCache();

    const kbdCache = this.keyboardRequisitioner.cache;
    this.interface.setKeyboardCache(this.keyboardRequisitioner.cache);

    this.processor = new InputProcessor(config.hostDevice, worker, this.processorConfiguration());

    this.contextManager.configure({
      resetContext: (target) => {
        this.processor.keyboardProcessor.resetContext(target);
      },
      predictionContext: new PredictionContext(this.processor.languageProcessor, this.processor.keyboardProcessor),
      keyboardCache: this.keyboardRequisitioner.cache
    });

    // TODO:  configure that context-manager!

    // #region Event handler wiring
    kbdCache.on('stubAdded', (stub) => {
      let eventRaiser = () => {
        // The corresponding event is needed in order to update UI modules as new keyboard stubs "come online".
        this.legacyAPIEvents.emit('kmw.keyboardregistered', {
          internalName: stub.KI,
          language: stub.KL,
          keyboardName: stub.KN,
          languageCode: stub.KLC,
          package: stub.KP
        });
      }

      if(this.config.deferForInitialization.hasFinalized) {
        eventRaiser();
      } else {
        this.config.deferForInitialization.then(eventRaiser);
      }
    });

    kbdCache.on('keyboardAdded', (keyboard) => {
      let eventRaiser = () => {
        // Execute any external (UI) code needed after loading keyboard
        this.legacyAPIEvents.emit('kmw.keyboardloaded', {
          keyboardName: keyboard.id
        });
      }

      if(this.config.deferForInitialization.hasFinalized) {
        eventRaiser();
      } else {
        this.config.deferForInitialization.then(eventRaiser);
      }
    });

    contextManager.on('keyboardchange', (kbd) => {
      this.refreshModel();

      // Hide OSK and do not update keyboard list if using internal keyboard (desktops).
      // Condition will not be met for touch form-factors; they force selection of a
      // default keyboard.
      if(kbd.keyboard == null && kbd.metadata == null) {
        this.osk.startHide(false);
      }

      if(this.osk) {
        this.osk.setNeedsLayout();
        this.osk.activeKeyboard = kbd;
        this.osk.present();
      }
    });

    contextManager.on('keyboardasyncload', (metadata) => {
      /* Original implementation pre-modularization:
       *
       * > Force OSK display for CJK keyboards (keyboards using a pick list)
       *
       * A matching subcondition in the block below will ensure that the OSK activates pre-load
       * for CJK keyboards.  Yes, even before a CJK picker could ever show.  We should be fine
       * without the CJK check so long as a picker keyboard's OSK is kept activated post-load,
       * when the picker actually needs to be kept persistently-active.
       * `metadata` would be relevant a the CJK-check, which was based on language codes.
       *
       * Of course, as mobile devices don't have guaranteed physical keyboards... we need to
       * keep the OSK visible for them, hence the actual block below.
       */
      if(this.config.hostDevice.touchable && this.osk?.activationModel) {
        this.osk.activationModel.enabled = true;
        // Also note:  the OSKView.mayDisable method returns false when hostDevice.touchable = false.
        // The .startHide() call below will check that method before actually starting an OSK hide.
      }

      // Always (temporarily) hide the OSK when loading a new keyboard, to ensure
      // that a failure to load doesn't leave the current OSK displayed
      this.osk?.startHide(false);
    })
    // #endregion
  }

  init(optionSpec: Required<InitOptionSpec>): void {
    // There may be some valid mutations possible even on repeated calls?
    // The original seems to allow it.

    if(this.config.deferForInitialization.hasFinalized) {
      // abort!  Maybe throw an error, too.
      return;
    }

    this.config.initialize(optionSpec);
  }

  public get hardKeyboard(): HardKeyboard {
    return this._hardKeyboard;
  }

  protected set hardKeyboard(keyboard: HardKeyboard) {
    if(this._hardKeyboard) {
      this._hardKeyboard.off('keyEvent', this.keyEventListener);
    }
    this._hardKeyboard = keyboard;
    keyboard.on('keyEvent', this.keyEventListener);
  }

  public get osk(): OSKView {
    return this._osk;
  }

  public set osk(value: OSKView) {
    if(this._osk) {
      this._osk.off('keyEvent', this.keyEventListener);
    }
    this._osk = value;
    this._osk.on('keyEvent', this.keyEventListener);
  }

  public getDebugInfo(): Record<string, any> {
    const report = {
      configReport: this.config.debugReport()
      // oskType / oskReport?
      // - mode
      // - dimensions
      // other possible entries?
    };

    return report;
  }

  private refreshModel() {
    const kbd = this.contextManager.activeKeyboard;
    const model = this.modelCache.modelForLanguage(kbd.metadata.langId);

    if(this.processor.activeModel != model) {
      if(this.processor.activeModel) {
        this.processor.languageProcessor.unloadModel();
      }

      if(model) {
        this.processor.languageProcessor.loadModel(model);
      }
    }
  }

  // API methods

  // 17.0: new!  Only used by apps utilizing app/webview and one app/browser test page.
  addModel(model: ModelSpec) {
    this.modelCache.register(model);

    if(model.languages.indexOf(this.contextManager.activeKeyboard.metadata.langId) != -1) {
      this.refreshModel();
    }
  }

  // 17.0: new!  Only used by apps utilizing app/webview and one app/browser test page.
  removeModel(modelId: string) {
    this.modelCache.deregister(modelId);

    // Is it the active model?
    if(this.processor.activeModel && this.processor.activeModel.id == modelId) {
      this.processor.languageProcessor.unloadModel();
    }
  }

  async setActiveKeyboard(keyboardId: string, languageCode?: string): Promise<boolean> {
    return this.contextManager.activateKeyboard(keyboardId, languageCode, true);
  }
}

// Intent:  define common behaviors for both primary app types; each then subclasses & extends where needed.