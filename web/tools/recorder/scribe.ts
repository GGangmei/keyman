/// <reference path="recorder_InputEvents.ts" />
/// <reference path="../../node_modules/eventemitter3/index.js" />

//Since TS won't recognize the types b/c no "import"/"require" statements.
// A small-scale manual definition.
declare class EventEmitter {
  /** Add a listener for a given event */
  on(event: string, func: (...args: any[]) => boolean, context?: any);
  /** Add a one-time listener for a given event */
  once(event: string, func: (...args: any[]) => boolean, context?: any);
  removeListener(event: string, func: (...args: any[]) => boolean, context?: any, once?: boolean);

  // Defines their alternately-themed aliases.
  addListener: typeof EventEmitter.prototype.on;
  off: typeof EventEmitter.prototype.removeListener;

  // Defines the actual event-raising function.
  emit(eventName: string, ...args: any[]);
}

// Makes sure the code below knows that the namespaces exist.
namespace com.keyman {
  export namespace dom {
    export declare var DOMEventHandlers: any;
    export declare class Utils {
      static getOutputTarget(elem: HTMLElement): any; // text.OutputTarget;
    }
  }

  export namespace osk {
    export declare var PreProcessor: any;
  }
}

namespace KMWRecorder {
  /**
   * Contains browser-dependent code used to transcribe browser-based events 
   * so that thay may be reconstructed for use in KMW testing. 
   */
  export class Scribe extends EventEmitter {
    //#region Static methods for recording input events
    static recordKeyboardEvent(e: KeyboardEvent): PhysicalInputEvent {
      let recording = new PhysicalInputEvent();

      recording.key    = e.key;
      recording.code    = e.code;
      recording.keyCode = e.keyCode;
      recording.location = e.location;

      var flagSet: number = 0;

      for(var key in PhysicalInputEvent.modifierCodes) {
        if(e.getModifierState(key)) {
          flagSet |= PhysicalInputEvent.modifierCodes[key];
        }
      }

      recording.modifierSet = flagSet;

      return recording;
    }

    static recordOSKEvent(e: HTMLDivElement): OSKInputEvent {
      let recording = new OSKInputEvent();
      recording.keyID = e.id;
      return recording;
    }

    static recordKeyboardStub(activeStub: any, basePath: string): KeyboardStub {
      let recording = new KeyboardStub();

      recording.id = activeStub.KI;
      recording.id = recording.id.replace('Keyboard_', '');

      recording.name = activeStub.KN;
      recording.filename = Scribe._setStubBasePath(activeStub.KF, basePath);

      recording.languages = [new LanguageStubForKeyboard(activeStub)];

      return recording;
    }

    private static _setStubBasePath(filename: string, filePath: string, force?: boolean): string {
      var linkParser = document.createElement<"a">("a");
      linkParser.href = filePath;

      if(force === undefined) {
        force = true;
      }

      if(force || (filename.indexOf(linkParser.protocol) < 0 && filename.indexOf('/') != 0)) {
        var file = filename.substr(filename.lastIndexOf('/')+1);
        return filePath + '/' + file;
      } else {
        return file;
      }
    }
    //#endregion

    // TODO:  rename variable to something better.  Currently preserved for easier refactoring comparisons.
    inputJSON: InputTestSequence = new InputTestSequence();
    testDefinition: KeyboardTest = new KeyboardTest();

    keyboardJustActivated: boolean = false;

    addInputRecord(json: InputEvent, currentOutput: string) {
      this.inputJSON.addInput(json, currentOutput);
      this.raiseRecordChanged();
    }

    resetInputRecord() {
      window['keyman'].resetContext();
      this.inputJSON = new KMWRecorder.InputTestSequence();

      this.emit('record-reset', null);
    }

    setInputRecord(record: InputTestSequence) {
      this.inputJSON = record;
      this.raiseRecordChanged();
    }

    errorUpdate(msg: string) {
      if(msg) {
        this.inputJSON.msg = msg;
      } else {
        delete this.inputJSON.msg;
      }
    
      this.raiseRecordChanged();
    }

    private raiseRecordChanged() {
      this.emit('record-changed', this.inputJSON.toPrettyJSON());
    }

    saveInputRecord(config: Constraint) {
      if(this.inputJSON.inputs.length > 0) {
        this.testDefinition.addTest(config, this.inputJSON);
      }
      this.resetInputRecord();
      this.raiseTestChanged();
    }

    setTestDefinition(testDef: KeyboardTest) {
      if(!testDef) {
        testDef = new KeyboardTest();
      }
      this.testDefinition = testDef;
      this.raiseTestChanged();
    }

    private raiseTestChanged() {
      this.emit('test-changed', this.testDefinition ? JSON.stringify(this.testDefinition, null, '  ') : '');
    }

    // Time for the 'magic'.  Yay, JavaScript method extension strategies...
    initHooks(recordingElement: HTMLElement) {
      let keyman = window['keyman'];
      let recorderScribe = this;

      let _originalKeyDown = keyman.touchAliasing._KeyDown.bind(keyman.touchAliasing);
      keyman.touchAliasing._KeyDown = function(e) {
        let in_output = com.keyman.dom.Utils.getOutputTarget(recordingElement);
        if(!in_output || com.keyman.dom.DOMEventHandlers.states.activeElement != in_output.getElement()) {
          return _originalKeyDown(e);
        }

        var event = KMWRecorder.Scribe.recordKeyboardEvent(e);
        var retVal = _originalKeyDown(e);

        // Record the keystroke as part of a test sequence!
        // Miniature delay in case the keyboard relies upon default backspace/delete behavior!
        window.setTimeout(function() {
          recorderScribe.addInputRecord(event, in_output.getText());
        }, 1);
        
        return retVal;
      }

      var _originalClickKey = com.keyman.osk.PreProcessor.clickKey; //.bind(keyman.osk);
      com.keyman.osk.PreProcessor.clickKey = function(e) {
        let in_output = com.keyman.dom.Utils.getOutputTarget(recordingElement);
        if(!in_output || com.keyman.dom.DOMEventHandlers.states.activeElement != in_output.getElement()) {
          return _originalClickKey(e);
        }

        var event = KMWRecorder.Scribe.recordOSKEvent(e);
        var retVal = _originalClickKey(e);

        // Record the click/touch as part of a test sequence!
        recorderScribe.addInputRecord(event, in_output.getText());
        return retVal;
      }

      var _originalSetActiveKeyboard = keyman.keyboardManager._SetActiveKeyboard.bind(keyman.keyboardManager);
      keyman.keyboardManager._SetActiveKeyboard = function(PInternalName, PLgCode, saveCookie) {
        let in_output = com.keyman.dom.Utils.getOutputTarget(recordingElement);
        // If it's not on our recording control, ignore the change and do nothing special.
        if(!in_output || document.activeElement != in_output.getElement()) {
          _originalSetActiveKeyboard(PInternalName, PLgCode, saveCookie);
          return;
        }

        let testDefinition = recorderScribe.testDefinition;
        var sameKbd = (testDefinition.keyboard && ("Keyboard_" + testDefinition.keyboard.id) == PInternalName)
          && (testDefinition.keyboard.getFirstLanguage() == PLgCode);

        if(!testDefinition.isEmpty() && !sameKbd && !recorderScribe.keyboardJustActivated) {
          if(!confirm("Changing the keyboard will clear the current test set.  Are you sure?")) {
            _originalSetActiveKeyboard("Keyboard_" + testDefinition.keyboard.id, testDefinition.keyboard.languages[0].id);
            return;
          }
        }
        _originalSetActiveKeyboard(PInternalName, PLgCode, saveCookie);

        // What's the active stub immediately after our _SetActiveKeyboard call?
        var internalStub = keyman.keyboardManager.activeStub;
        if(internalStub && (com.keyman.dom.DOMEventHandlers.states.activeElement == in_output.getElement())) {
          var kbdRecord = KMWRecorder.Scribe.recordKeyboardStub(internalStub, 'resources/keyboards');

          recorderScribe.emit('stub-changed', JSON.stringify(kbdRecord));
          // var ta_activeStub = document.getElementById('activeStub');
          // ta_activeStub.value = JSON.stringify(kbdRecord);
          
          if(!sameKbd && !recorderScribe.keyboardJustActivated) {
            recorderScribe.setTestDefinition(new KMWRecorder.KeyboardTest(kbdRecord));
          }
        }
        recorderScribe.keyboardJustActivated = false;
      }
    }
  }
}