// Establishes key-code definitions.
/// <reference path="codes.ts" />

namespace com.keyman.text {
  export class KeyEvent {
    Ltarg: HTMLElement;
    Lcode: number;
    Lstates: number;
    LmodifierChange?: boolean;
    Lmodifiers: number;
    LisVirtualKeyCode?: boolean;
    LisVirtualKey: boolean;
    vkCode: number
  };

  export class LegacyKeyEvent {
    Ltarg: HTMLElement;
    Lcode: number;
    Lmodifiers: number;
    LisVirtualKey: number;
  }

  export class Processor {

    // Tracks the simulated value for supported state keys, allowing the OSK to mirror a physical keyboard for them.
    // Using the exact keyCode name from the Codes definitions will allow for certain optimizations elsewhere in the code.
    stateKeys = {
      "K_CAPS":false,
      "K_NUMLOCK":false,
      "K_SCROLL":false
    };

    // Tracks the most recent modifier state information in order to quickly detect changes
    // in keyboard state not otherwise captured by the hosting page in the browser.
    // Needed for AltGr simulation.
    modStateFlags: number = 0;
    // Denotes whether or not KMW needs to 'swallow' the next keypress.
    swallowKeypress: boolean = false;


    /**
     * Get the default key string. If keyName is U_xxxxxx, use that Unicode codepoint.
     * Otherwise, lookup the  virtual key code (physical keyboard mapping)
     *
     * @param   {string}  keyName Name of the key
     * @param   {number}  n
     * @param   {number}  keyShiftState
     * @param   {boolean} usingOSK
     * @param   {Object=} Lelem
     * @return  {string}
     */
    defaultKeyOutput(keyName: string, n: number, keyShiftState: number, usingOSK: boolean, Lelem?: HTMLElement): string {
      let keyman = com.keyman.singleton;
      let domManager = keyman.domManager;

      var ch = '', checkCodes = false;
      var touchAlias = (Lelem && typeof(Lelem.base) != 'undefined');
      // check if exact match to SHIFT's code.  Only the 'default' and 'shift' layers should have default key outputs.
      if(keyShiftState == 0) {
        checkCodes = true;
      } else if (keyShiftState == Codes.modifierCodes['SHIFT']) {
        checkCodes = true; 
        keyShiftState = 1; // It's used as an index.
      } else {
        console.warn("KMW only defines default key output for the 'default' and 'shift' layers!");
      }

      // If this was triggered by the OSK -or- if it was triggered within a touch-aliased DIV element.
      if(touchAlias || usingOSK) {
        var code = Codes.keyCodes[keyName];
        if(!code) {
          code = n;
        }

        switch(code) {
          case Codes.keyCodes['K_BKSP']:  //Only desktop UI, not touch devices. TODO: add repeat while mouse down for desktop UI
            keyman.interface.defaultBackspace();
            break;
          case Codes.keyCodes['K_TAB']:
            domManager.moveToNext(keyShiftState);
            break;
          case Codes.keyCodes['K_TABBACK']:
            domManager.moveToNext(true);
            break;
          case Codes.keyCodes['K_TABFWD']:
            domManager.moveToNext(false);
            break;
          case Codes.keyCodes['K_ENTER']:
            // Insert new line in text area fields
            if(Lelem.nodeName == 'TEXTAREA' || (typeof Lelem.base != 'undefined' && Lelem.base.nodeName == 'TEXTAREA')) {
              return '\n';
            // Or move to next field from TEXT fields
            } else if(usingOSK) {
              var inputEle: HTMLInputElement;
              if(dom.Utils.instanceof(Lelem, "HTMLInputElement")) {
                inputEle = <HTMLInputElement> Lelem;
              } else if(typeof(Lelem.base) != 'undefined' && dom.Utils.instanceof(Lelem.base, "HTMLInputElement")) {
                inputEle = <HTMLInputElement> Lelem.base;
              }

              if (inputEle && (inputEle.type == 'search' || inputEle.type == 'submit')) {
                inputEle.disabled=false;
                inputEle.form.submit();
              } else {
                domManager.moveToNext(false);
              }
            }
            break;
          case Codes.keyCodes['K_SPACE']:
            return ' ';
          // break;
          //
          // // Problem:  clusters, and doing them right.
          // // The commented-out code below should be a decent starting point, but clusters make it complex.
          //
          // case VisualKeyboard.keyCodes['K_LEFT']:
          //   if(touchAlias) {
          //     var caretPos = keymanweb.getTextCaret(Lelem);
          //     keymanweb.setTextCaret(Lelem, caretPos - 1 >= 0 ? caretPos - 1 : 0);
          //   }
          //   break;
          // case VisualKeyboard.keyCodes['K_RIGHT']:
          //   if(touchAlias) {
          //     var caretPos = keymanweb.getTextCaret(Lelem);
          //     keymanweb.setTextCaret(Lelem, caretPos + 1);
          //   }
          //   if(code == VisualKeyboard.keyCodes['K_RIGHT']) {
          //     break;
          //   }
          // // Should we include this?  It could be tricky to do correctly...
          // case VisualKeyboard.keyCodes['K_DEL']:
          //   // Move caret right one unit, then backspace.
          //   if(touchAlias) {
          //     var caretPos = keymanweb.getTextCaret(Lelem);
          //     keymanweb.setTextCaret(Lelem, caretPos + 1);
          //     if(caretPos == keymanweb.getTextCaret(Lelem)) {
          //       // Failed to move right - there's nothing to delete.
          //       break;
          //     }
          //     kbdInterface.defaultBackspace();
          //   }
        }
      }

      // TODO:  Refactor the overloading of the 'n' parameter here into separate methods.

      // Test for fall back to U_xxxxxx key id
      // For this first test, we ignore the keyCode and use the keyName
      if((keyName.substr(0,2) == 'U_')) {
        var codePoint = parseInt(keyName.substr(2,6), 16);
        if (((0x0 <= codePoint) && (codePoint <= 0x1F)) || ((0x80 <= codePoint) && (codePoint <= 0x9F))) {
          // Code points [U_0000 - U_001F] and [U_0080 - U_009F] refer to Unicode C0 and C1 control codes.
          // Check the codePoint number and do not allow output of these codes via U_xxxxxx shortcuts.
          console.log("Suppressing Unicode control code: U_00" + codePoint.toString(16));
          return ch;
        } else {
          // String.fromCharCode() is inadequate to handle the entire range of Unicode
          // Someday after upgrading to ES2015, can use String.fromCodePoint()
          ch=String.kmwFromCharCode(codePoint);
        }
        // Hereafter, we refer to keyCodes.
      } else if(checkCodes) { // keyShiftState can only be '1' or '2'.
        try {
          if(n >= Codes.keyCodes['K_0'] && n <= Codes.keyCodes['K_9']) { // The number keys.
            ch = Codes.codesUS[keyShiftState][0][n-Codes.keyCodes['K_0']];
          } else if(n >= Codes.keyCodes['K_A'] && n <= Codes.keyCodes['K_Z']) { // The base letter keys
            ch = String.fromCharCode(n+(keyShiftState?0:32));  // 32 is the offset from uppercase to lowercase.
          } else if(n >= Codes.keyCodes['K_COLON'] && n <= Codes.keyCodes['K_BKQUOTE']) {
            ch = Codes.codesUS[keyShiftState][1][n-Codes.keyCodes['K_COLON']];
          } else if(n >= Codes.keyCodes['K_LBRKT'] && n <= Codes.keyCodes['K_QUOTE']) {
            ch = Codes.codesUS[keyShiftState][2][n-Codes.keyCodes['K_LBRKT']];
          }
        } catch (e) {
          console.error("Error detected with default mapping for key:  code = " + n + ", shift state = " + (keyShiftState == 1 ? 'shift' : 'default'));
        }
      }
      return ch;
    }

    /**
     * Function     _GetKeyEventProperties
     * Scope        Private
     * @param       {Event}       e         Event object
     * @param       {boolean=}    keyState  true if call results from a keyDown event, false if keyUp, undefined if keyPress
     * @return      {Object.<string,*>}     KMW keyboard event object: 
     * Description  Get object with target element, key code, shift state, virtual key state 
     *                Ltarg=target element
     *                Lcode=keyCode
     *                Lmodifiers=shiftState
     *                LisVirtualKeyCode e.g. ctrl/alt key
     *                LisVirtualKey     e.g. Virtual key or non-keypress event
     */    
    _GetKeyEventProperties(e: KeyboardEvent, keyState?: boolean) {
      var s = new KeyEvent();
      let keyman = com.keyman.singleton;

      e = keyman._GetEventObject(e);   // I2404 - Manage IE events in IFRAMEs
      s.Ltarg = keyman.util.eventTarget(e) as HTMLElement;
      if (s.Ltarg == null) {
        return null;
      }
      if(e.cancelBubble === true) {
        return null; // I2457 - Facebook meta-event generation mess -- two events generated for a keydown in Facebook contentEditable divs
      }      

      if (s.Ltarg.nodeType == 3) {// defeat Safari bug
        s.Ltarg = s.Ltarg.parentNode as HTMLElement;
      }

      s.Lcode = this._GetEventKeyCode(e);
      if (s.Lcode == null) {
        return null;
      }

      // Stage 1 - track the true state of the keyboard's modifiers.
      var prevModState = this.modStateFlags, curModState = 0x0000;
      var ctrlEvent = false, altEvent = false;
      
      let keyCodes = Codes.keyCodes;
      switch(s.Lcode) {
        case keyCodes['K_CTRL']:      // The 3 shorter "K_*CTRL" entries exist in some legacy keyboards.
        case keyCodes['K_LCTRL']:
        case keyCodes['K_RCTRL']:
        case keyCodes['K_CONTROL']:
        case keyCodes['K_LCONTROL']:
        case keyCodes['K_RCONTROL']:
          ctrlEvent = true;
          break;
        case keyCodes['K_LMENU']:     // The 2 "K_*MENU" entries exist in some legacy keyboards.
        case keyCodes['K_RMENU']:
        case keyCodes['K_ALT']:
        case keyCodes['K_LALT']:
        case keyCodes['K_RALT']:
          altEvent = true;
          break;
      }

      /**
       * Two separate conditions exist that should trigger chiral modifier detection.  Examples below use CTRL but also work for ALT.
       * 
       * 1.  The user literally just pressed CTRL, so the event has a valid `location` property we can utilize.  
       *     Problem: its layer isn't presently activated within the OSK.
       * 
       * 2.  CTRL has been held a while, so the OSK layer is valid, but the key event doesn't tell us the chirality of the active CTRL press.
       *     Bonus issue:  RAlt simulation may cause erasure of this location property, but it should ONLY be empty if pressed in this case.
       *     We default to the 'left' variants since they're more likely to exist and cause less issues with RAlt simulation handling.
       * 
       * In either case, `e.getModifierState("Control")` is set to true, but as a result does nothing to tell us which case is active.
       * 
       * `e.location != 0` if true matches condition 1 and matches condition 2 if false.
       */

      curModState |= (e.getModifierState("Shift") ? 0x10 : 0);

      let modifierCodes = Codes.modifierCodes;
      if(e.getModifierState("Control")) {
        curModState |= ((e.location != 0 && ctrlEvent) ? 
          (e.location == 1 ? modifierCodes['LCTRL'] : modifierCodes['RCTRL']) : // Condition 1
          prevModState & 0x0003);                                                       // Condition 2
      }
      if(e.getModifierState("Alt")) {
        curModState |= ((e.location != 0 && altEvent) ? 
          (e.location == 1 ? modifierCodes['LALT'] : modifierCodes['RALT']) :   // Condition 1
          prevModState & 0x000C);                                                       // Condition 2
      }

      // Stage 2 - detect state key information.  It can be looked up per keypress with no issue.
      s.Lstates = 0;
      
      s.Lstates |= e.getModifierState('CapsLock') ? modifierCodes['CAPS'] : modifierCodes['NO_CAPS'];
      s.Lstates |= e.getModifierState('NumLock') ? modifierCodes['NUM_LOCK'] : modifierCodes['NO_NUM_LOCK'];
      s.Lstates |= (e.getModifierState('ScrollLock') || e.getModifierState("Scroll")) // "Scroll" for IE9.
        ? modifierCodes['SCROLL_LOCK'] : modifierCodes['NO_SCROLL_LOCK'];

      // We need these states to be tracked as well for proper OSK updates.
      curModState |= s.Lstates;

      // Stage 3 - Set our modifier state tracking variable and perform basic AltGr-related management.
      s.LmodifierChange = this.modStateFlags != curModState;
      this.modStateFlags = curModState;

      // For European keyboards, not all browsers properly send both key-up events for the AltGr combo.
      var altGrMask = modifierCodes['RALT'] | modifierCodes['LCTRL'];
      if((prevModState & altGrMask) == altGrMask && (curModState & altGrMask) != altGrMask) {
        // We just released AltGr - make sure it's all released.
        curModState &= ~ altGrMask;
      }
      // Perform basic filtering for Windows-based ALT_GR emulation on European keyboards.
      if(curModState & modifierCodes['RALT']) {
        curModState &= ~modifierCodes['LCTRL'];
      }

      let modifierBitmasks = Codes.modifierBitmasks;
      // Stage 4 - map the modifier set to the appropriate keystroke's modifiers.
      if(keyman.keyboardManager.isChiral()) {
        s.Lmodifiers = curModState & modifierBitmasks.CHIRAL;

        // Note for future - embedding a kill switch here or in keymanweb.osk.emulatesAltGr would facilitate disabling
        // AltGr / Right-alt simulation.
        if(osk.Layouts.emulatesAltGr() && (s.Lmodifiers & modifierBitmasks['ALT_GR_SIM']) == modifierBitmasks['ALT_GR_SIM']) {
          s.Lmodifiers ^= modifierBitmasks['ALT_GR_SIM'];
          s.Lmodifiers |= modifierCodes['RALT'];
        }
      } else {
        // No need to sim AltGr here; we don't need chiral ALTs.
        s.Lmodifiers = 
          (curModState & 0x10) | // SHIFT
          ((curModState & (modifierCodes['LCTRL'] | modifierCodes['RCTRL'])) ? 0x20 : 0) | 
          ((curModState & (modifierCodes['LALT'] | modifierCodes['RALT']))   ? 0x40 : 0); 
      }

      // Mnemonic handling.
      var activeKeyboard = keyman.keyboardManager.activeKeyboard;

      if(activeKeyboard && activeKeyboard['KM']) {
        // The following will never set a code corresponding to a modifier key, so it's fine to do this,
        // which may change the value of Lcode, here.
        this.setMnemonicCode(s, e.getModifierState("Shift"), e.getModifierState("CapsLock"));
      }

      // The 0x6F used to be 0x60 - this adjustment now includes the chiral alt and ctrl modifiers in that check.
      s.LisVirtualKeyCode = (typeof e.charCode != 'undefined' && e.charCode != null  &&  (e.charCode == 0 || (s.Lmodifiers & 0x6F) != 0));
      s.LisVirtualKey = s.LisVirtualKeyCode || e.type != 'keypress';
      
      return s;
    }

    static getOutputTarget(Lelem?: HTMLElement): dom.EditableElement {
      let keyman = com.keyman.singleton;

      if(!Lelem && !keyman.isHeadless) {
        Lelem = keyman.domManager.getLastActiveElement();
        if(!Lelem) {
          // If we're trying to find an active target but one doesn't exist, just return null.
          return null;
        }
      }

      // If we were provided an element or found an active element but it's improperly attached, that should cause an error.
      if(Lelem._kmwAttachment && Lelem._kmwAttachment.interface) {
        return Lelem._kmwAttachment.interface;
      } else {
        throw new Error("OSK could not find element output target data!");
      }
    }

    /**
     * Simulate a keystroke according to the touched keyboard button element
     *
     * Note that the test-case oriented 'recorder' stubs this method to facilitate OSK-based input
     * recording for use in test cases.  If changing this function, please ensure the recorder is
     * not affected.
     * 
     * @param       {Object}      e      element touched (or clicked)
     */
    clickKey(e: osk.KeyElement) {
      let keyman = com.keyman.singleton;
      var Lelem = keyman.domManager.getLastActiveElement();

      var activeKeyboard = keyman.keyboardManager.activeKeyboard;
      let kbdInterface = keyman.interface;
      let formFactor = keyman.util.device.formFactor;

      if(Lelem != null) {
        // Get key name and keyboard shift state (needed only for default layouts and physical keyboard handling)
        // Note - virtual keys should be treated case-insensitive, so we force uppercasing here.
        var layer=e['key'].spec.layer || '', keyName=e['keyId'].toUpperCase(), keyShiftState=this.getModifierState(keyman['osk'].vkbd.layerId);
        var nextLayer: string = e['key'].spec['nextlayer'];

        keyman.domManager.initActiveElement(Lelem);

        // Exclude menu and OSK hide keys from normal click processing
        if(keyName == 'K_LOPT' || keyName == 'K_ROPT') {
          keyman['osk'].vkbd.optionKey(e, keyName, true);
          return true;
        }

        // Turn off key highlighting (or preview)
        keyman['osk'].vkbd.highlightKey(e,false);

        // The default OSK layout for desktop devices does not include nextlayer info, relying on modifier detection here.
        // It's the OSK equivalent to doModifierPress on 'desktop' form factors.
        if(formFactor == 'desktop') {
          if(this.selectLayer(keyName, nextLayer)) {
            return true;
          }
        }

        // Prevent any output from 'ghost' (unmapped) keys
        if(keyName != 'K_SPACE') {
          var keyText=(<HTMLElement> e.childNodes[0]).innerHTML;
          //// if(keyText == '' || keyText == '&nbsp;') return true; --> why?
        }

        keyman.uiManager.setActivatingUI(true);
        com.keyman.DOMEventHandlers.states._IgnoreNextSelChange = 100;
        keyman.domManager.focusLastActiveElement();
        if(keyman.domManager._IsMozillaEditableIframe(<HTMLIFrameElement> Lelem,0)) {
          Lelem = (<HTMLIFrameElement> Lelem).contentDocument.documentElement;
        }
        com.keyman.DOMEventHandlers.states._IgnoreNextSelChange = 0;

        // ...end I3363 (Build 301)
        let outputTarget = Processor.getOutputTarget(Lelem);
        
        // Clear any cached codepoint data; we can rebuild it if it's unchanged.
        outputTarget.invalidateSelection();
        // Deadkey matching continues to be troublesome.
        // Deleting matched deadkeys here seems to correct some of the issues.   (JD 6/6/14)
        outputTarget.deadkeys().deleteMatched();      // Delete any matched deadkeys before continuing
        //kbdInterface._DeadkeyResetMatched();       // I3318   (Not needed if deleted first?)

        // Start:  mirrors _GetKeyEventProperties
        // First check the virtual key, and process shift, control, alt or function keys
        var Lkc: KeyEvent = {
          Ltarg: Lelem,
          Lmodifiers: 0,
          Lstates: 0,
          Lcode: Codes.keyCodes[keyName],
          LisVirtualKey: true,
          vkCode: 0
        };

        // Set the flags for the state keys.
        Lkc.Lstates |= this.stateKeys['K_CAPS']    ? Codes.modifierCodes['CAPS'] : Codes.modifierCodes['NO_CAPS'];
        Lkc.Lstates |= this.stateKeys['K_NUMLOCK'] ? Codes.modifierCodes['NUM_LOCK'] : Codes.modifierCodes['NO_NUM_LOCK'];
        Lkc.Lstates |= this.stateKeys['K_SCROLL']  ? Codes.modifierCodes['SCROLL_LOCK'] : Codes.modifierCodes['NO_SCROLL_LOCK'];

        // Set LisVirtualKey to false to ensure that nomatch rule does fire for U_xxxx keys
        if(keyName.substr(0,2) == 'U_') {
          Lkc.LisVirtualKey=false;
        }

        // Get code for non-physical keys (T_KOKAI, U_05AB etc)
        if(typeof Lkc.Lcode == 'undefined') {
          Lkc.Lcode = this.getVKDictionaryCode(keyName);// Updated for Build 347
          if(!Lkc.Lcode) {
            // Special case for U_xxxx keys. This vk code will never be used
            // in a keyboard, so we use this to ensure that keystroke processing
            // occurs for the key.
            Lkc.Lcode = 1; 
          }
        }

        // Override key shift state if specified for key in layout (corrected for popup keys KMEW-93)
        keyShiftState = this.getModifierState(e['key'].spec['layer'] || layer);

        // Define modifiers value for sending to keyboard mapping function
        Lkc.Lmodifiers = keyShiftState;

        // Handles modifier states when the OSK is emulating rightalt through the leftctrl-leftalt layer.
        if((Lkc.Lmodifiers & Codes.modifierBitmasks['ALT_GR_SIM']) == Codes.modifierBitmasks['ALT_GR_SIM'] && osk.Layouts.emulatesAltGr()) {
          Lkc.Lmodifiers &= ~Codes.modifierBitmasks['ALT_GR_SIM'];
          Lkc.Lmodifiers |= Codes.modifierCodes['RALT'];
        }

        // End - mirrors _GetKeyEventProperties

        // Include *limited* support for mnemonic keyboards (Sept 2012)
        // If a touch layout has been defined for a mnemonic keyout, do not perform mnemonic mapping for rules on touch devices.
        if(activeKeyboard && activeKeyboard['KM'] && !(activeKeyboard['KVKL'] && formFactor != 'desktop')) {
          if(Lkc.Lcode != Codes.keyCodes['K_SPACE']) { // exception required, March 2013
            // Jan 2019 - interesting that 'K_SPACE' also affects the caps-state check...
            Lkc.vkCode = Lkc.Lcode;
            this.setMnemonicCode(Lkc, layer.indexOf('shift') != -1, this.stateKeys['K_CAPS']);
          }
        } else {
          Lkc.vkCode=Lkc.Lcode;
        }

        // Support version 1.0 KeymanWeb keyboards that do not define positional vs mnemonic
        if(typeof activeKeyboard['KM'] == 'undefined') {
          Lkc.Lcode=keyman.keyMapManager._USKeyCodeToCharCode(Lkc);
          Lkc.LisVirtualKey=false;
        }

        // End mnemonic management.

        // Pass this key code and state to the keyboard program
        if(!activeKeyboard || (Lkc.Lcode != 0 && !kbdInterface.processKeystroke(keyman.util.device, outputTarget, Lkc))) {
          // Restore the virtual key code if a mnemonic keyboard is being used
          Lkc.Lcode=Lkc.vkCode;

          // Handle unmapped keys, including special keys
          switch(keyName) {
            case 'K_CAPS':
            case 'K_NUMLOCK':
            case 'K_SCROLL':
              this.stateKeys[keyName] = ! this.stateKeys[keyName];

              // Will also call VisualKeyboard._UpdateVKShiftStyle, updating the OSK's state key visualization.
              com.keyman.singleton.osk._Show();
              break;
            default:
              // The following is physical layout dependent, so should be avoided if possible.  All keys should be mapped.
              var ch = this.defaultKeyOutput(keyName, Lkc.Lcode, keyShiftState, true, Lelem);
              if(ch) {
                kbdInterface.output(0, outputTarget, ch);
              }
          }
        }

        // Swap layer as appropriate.
        //this.nextLayer = nextLayer; // Is it safe to remove this?
        this.selectLayer(keyName, nextLayer);

        /* I732 END - 13/03/2007 MCD: End Positional Layout support in OSK */
      }
      
      keyman.uiManager.setActivatingUI(false);	// I2498 - KeymanWeb OSK does not accept clicks in FF when using automatic UI
      return true;
    }

    // FIXME:  makes some bad assumptions.
    setMnemonicCode(Lkc: KeyEvent, shifted: boolean, capsActive: boolean) {
      // K_SPACE is not handled by defaultKeyOutput for physical keystrokes unless using touch-aliased elements.
      // It's also a "exception required, March 2013" for clickKey, so at least they both have this requirement.
      if(Lkc.Lcode != Codes.keyCodes['K_SPACE']) {
        // So long as the key name isn't prefixed with 'U_', we'll get a default mapping based on the Lcode value.
        // We need to determine the mnemonic base character - for example, SHIFT + K_PERIOD needs to map to '>'.
        var mappedChar: string = this.defaultKeyOutput('K_xxxx', Lkc.Lcode, (shifted ? 0x10 : 0), false, null);
        if(mappedChar) {
          // FIXME;  Warning - will return 96 for 'a', which is a keycode corresponding to Codes.keyCodes('K_NP1') - a numpad key.
          Lkc.Lcode = mappedChar.charCodeAt(0);
        } // No 'else' - avoid blocking modifier keys, etc.
      }

      if(capsActive) {
        // TODO:  Needs fixing - does not properly mirror physical keystrokes, as Lcode range 96-111 corresponds
        // to numpad keys!  (Physical keyboard section has its own issues here.)
        if((Lkc.Lcode >= 65 && Lkc.Lcode <= 90) /* 'A' - 'Z' */ || (Lkc.Lcode >= 97 && Lkc.Lcode <= 122) /* 'a' - 'z' */) {
          Lkc.Lmodifiers ^= 0x10;  // Flip the 'shifted' bit, so it'll act as the opposite key.
          Lkc.Lcode ^= 0x20; // Flips the 'upper' vs 'lower' bit for the base 'a'-'z' ASCII alphabetics.
        }
      }
    }

    /**
     * Get modifier key state from layer id
     *
     * @param       {string}      layerId       layer id (e.g. ctrlshift)
     * @return      {number}                    modifier key state (desktop keyboards)
     */
    getModifierState(layerId: string): number {
      var modifier=0;
      if(layerId.indexOf('shift') >= 0) {
        modifier |= Codes.modifierCodes['SHIFT'];
      }

      // The chiral checks must not be directly exclusive due each other to visual OSK feedback.
      var ctrlMatched=false;
      if(layerId.indexOf('leftctrl') >= 0) {
        modifier |= Codes.modifierCodes['LCTRL'];
        ctrlMatched=true;
      } 
      if(layerId.indexOf('rightctrl') >= 0) {
        modifier |= Codes.modifierCodes['RCTRL'];
        ctrlMatched=true;
      } 
      if(layerId.indexOf('ctrl')  >= 0 && !ctrlMatched) {
        modifier |= Codes.modifierCodes['CTRL'];
      }

      var altMatched=false;
      if(layerId.indexOf('leftalt') >= 0) {
        modifier |= Codes.modifierCodes['LALT'];
        altMatched=true;
      } 
      if(layerId.indexOf('rightalt') >= 0) {
        modifier |= Codes.modifierCodes['RALT'];
        altMatched=true;
      } 
      if(layerId.indexOf('alt')  >= 0 && !altMatched) {
        modifier |= Codes.modifierCodes['ALT'];
      }

      return modifier;
    }

    /**
     * @summary Look up a custom virtual key code in the virtual key code dictionary KVKD.  On first run, will build the dictionary.
     *
     * `VKDictionary` is constructed from the keyboard's `KVKD` member. This list is constructed 
     * at compile-time and is a list of 'additional' virtual key codes, starting at 256 (i.e. 
     * outside the range of standard virtual key codes). These additional codes are both 
     * `[T_xxx]` and `[U_xxxx]` custom key codes from the Keyman keyboard language. However, 
     * `[U_xxxx]` keys only generate an entry in `KVKD` if there is a corresponding rule that 
     * is associated with them in the keyboard rules. If the `[U_xxxx]` key code is only 
     * referenced as the id of a key in the touch layout, then it does not get an entry in 
     * the `KVKD` property.
     *
     * @private
     * @param       {string}      keyName   custom virtual key code to lookup in the dictionary
     * @return      {number}                key code > 255 on success, or 0 if not found
     */
    getVKDictionaryCode(keyName: string) {
      let keyman = com.keyman.singleton;
      var activeKeyboard = keyman.keyboardManager.activeKeyboard;
      if(!activeKeyboard['VKDictionary']) {
        var a=[];
        if(typeof activeKeyboard['KVKD'] == 'string') {
          // Build the VK dictionary
          // TODO: Move the dictionary build into the compiler -- so compiler generates code such as following.  
          // Makes the VKDictionary member unnecessary.
          //       this.KVKD={"K_ABC":256,"K_DEF":257,...};
          var s=activeKeyboard['KVKD'].split(' ');
          for(var i=0; i<s.length; i++) {
            a[s[i].toUpperCase()]=i+256; // We force upper-case since virtual keys should be case-insensitive.
          }
        }
        activeKeyboard['VKDictionary']=a;
      }

      var res=activeKeyboard['VKDictionary'][keyName.toUpperCase()];
      return res ? res : 0;
    }

    /**
     * Function     _UpdateVKShift
     * Scope        Private
     * @param       {Object}            e     OSK event
     * @param       {number}            v     keyboard shift state
     * @param       {(boolean|number)}  d     set (1) or clear(0) shift state bits
     * @return      {boolean}                 Always true
     * Description  Updates the current shift state within KMW, updating the OSK's visualization thereof.
     */
    _UpdateVKShift(e, v: number, d: boolean|number): boolean {
      var keyShiftState=0, lockStates=0, i;
      let keyman = com.keyman.singleton;

      var lockNames  = ['CAPS', 'NUM_LOCK', 'SCROLL_LOCK'];
      var lockKeys   = ['K_CAPS', 'K_NUMLOCK', 'K_SCROLL'];

      if(e) {
        // read shift states from Pevent
        keyShiftState = e.Lmodifiers;
        lockStates = e.Lstates;

        // Are we simulating AltGr?  If it's a simulation and not real, time to un-simulate for the OSK.
        if(keyman.keyboardManager.isChiral() && osk.Layouts.emulatesAltGr() && 
            (this.modStateFlags & Codes.modifierBitmasks['ALT_GR_SIM']) == Codes.modifierBitmasks['ALT_GR_SIM']) {
          keyShiftState |= Codes.modifierBitmasks['ALT_GR_SIM'];
          keyShiftState &= ~Codes.modifierCodes['RALT'];
        }

        for(i=0; i < lockNames.length; i++) {
          if(lockStates & Codes.stateBitmasks[lockNames[i]]) {
            this.stateKeys[lockKeys[i]] = lockStates & Codes.modifierCodes[lockNames[i]];
          }
        }
      } else if(d) {
        keyShiftState |= v;

        for(i=0; i < lockNames.length; i++) {
          if(v & Codes.stateBitmasks[lockNames[i]]) {
            this.stateKeys[lockKeys[i]] = true;
          }
        }
      } else {
        keyShiftState &= ~v;

        for(i=0; i < lockNames.length; i++) {
          if(v & Codes.stateBitmasks[lockNames[i]]) {
            this.stateKeys[lockKeys[i]] = false;
          }
        }
      }

      // Find and display the selected OSK layer
      if(keyman['osk'].vkbd) {
        keyman['osk'].vkbd.showLayer(this.getLayerId(keyShiftState));
      }

      // osk._UpdateVKShiftStyle will be called automatically upon the next _Show.
      if(keyman.osk._Visible) {
        keyman.osk._Show();
      }

      return true;
    }

    getLayerId(modifier: number): string {
      return osk.Layouts.getLayerId(modifier);
    }

    /**
     * Select the OSK's next keyboard layer based upon layer switching keys as a default
     * The next layer will be determined from the key name unless otherwise specifed
     *
     *  @param  {string}                    keyName     key identifier
     *  @param  {number|string|undefined}   nextLayerIn optional next layer identifier
     *  @return {boolean}                               return true if keyboard layer changed
     */
    selectLayer(keyName: string, nextLayerIn?: number | string): boolean {
      var nextLayer = arguments.length < 2 ? null : nextLayerIn;
      let keyman = com.keyman.singleton;
      var isChiral = keyman.keyboardManager.isChiral();

      // Layer must be identified by name, not number (27/08/2015)
      if(typeof nextLayer == 'number') {
        nextLayer = this.getLayerId(nextLayer * 0x10);
      }

      // Identify next layer, if required by key
      if(!nextLayer) {
        switch(keyName) {
          case 'K_LSHIFT':
          case 'K_RSHIFT':
          case 'K_SHIFT':
            nextLayer = 'shift';
            break;
          case 'K_LCONTROL':
          case 'K_LCTRL':
            if(isChiral) {
              nextLayer = 'leftctrl';
              break;
            }
          case 'K_RCONTROL':
          case 'K_RCTRL':
            if(isChiral) {
              nextLayer = 'rightctrl';
              break;
            }
          case 'K_CTRL':
            nextLayer = 'ctrl';
            break;
          case 'K_LMENU':
          case 'K_LALT':
            if(isChiral) {
              nextLayer = 'leftalt';
              break;
            }
          case 'K_RMENU':
          case 'K_RALT':
            if(isChiral) {
              nextLayer = 'rightalt';
              break;
            }
          case 'K_ALT':
            nextLayer = 'alt';
            break;
          case 'K_ALTGR':
            if(isChiral) {
              nextLayer = 'leftctrl-rightalt';
            } else {
              nextLayer = 'ctrl-alt';
            }
            break;
          case 'K_CURRENCIES':
          case 'K_NUMERALS':
          case 'K_SHIFTED':
          case 'K_UPPER':
          case 'K_LOWER':
          case 'K_SYMBOLS':
            nextLayer = 'default';
            break;
        }
      }

      // If no key corresponding to a layer transition is pressed, maintain the current layer.
      if(!nextLayer) {
        return false;
      }

      // Change layer and refresh OSK
      this.updateLayer(nextLayer);
      com.keyman.singleton.osk._Show();

      return true;
    }

    /**
     * Sets the new layer id, allowing for toggling shift/ctrl/alt while preserving the remainder
     * of the modifiers represented by the current layer id (where applicable)
     *
     * @param       {string}      id      layer id (e.g. ctrlshift)
     */
    updateLayer(id: string) {
      let keyman = com.keyman.singleton;
      let vkbd = keyman['osk'].vkbd;

      if(!vkbd) {
        return;
      }

      let activeLayer = vkbd.layerId;
      var s = activeLayer;

      // Do not change layer unless needed (27/08/2015)
      if(id == activeLayer && keyman.util.device.formFactor != 'desktop') {
        return false;
      }

      var idx=id;
      var i;

      if(keyman.util.device.formFactor == 'desktop') {
        // Need to test if target layer is a standard layer (based on the plain 'default')
        var replacements= ['leftctrl', 'rightctrl', 'ctrl', 'leftalt', 'rightalt', 'alt', 'shift'];

        for(i=0; i < replacements.length; i++) {
          // Don't forget to remove the kebab-case hyphens!
          idx=idx.replace(replacements[i] + '-', '');
          idx=idx.replace(replacements[i],'');
        }

        // If we are presently on the default layer, drop the 'default' and go straight to the shifted mode.
        // If on a common symbolic layer, drop out of symbolic mode and go straight to the shifted mode.
        if(activeLayer == 'default' || activeLayer == 'numeric' || activeLayer == 'symbol' || activeLayer == 'currency' || idx != '') {
          s = id;
        }
        // Otherwise, we are based upon a layer that accepts modifier variations.
        // Modify the layer according to the current state and key pressed.
        //
        // TODO:  Consider:  should this ever be allowed for a base layer other than 'default'?  If not,
        // if(idx == '') with accompanying if-else structural shift would be a far better test here.
        else {
          // Save our current modifier state.
          var modifier=this.getModifierState(s);

          // Strip down to the base modifiable layer.
          for(i=0; i < replacements.length; i++) {
            // Don't forget to remove the kebab-case hyphens!
            s=s.replace(replacements[i] + '-', '');
            s=s.replace(replacements[i],'');
          }

          // Toggle the modifier represented by our input argument.
          switch(id) {
            case 'shift':
              modifier ^= Codes.modifierCodes['SHIFT'];
              break;
            case 'leftctrl':
              modifier ^= Codes.modifierCodes['LCTRL'];
              break;
            case 'rightctrl':
              modifier ^= Codes.modifierCodes['RCTRL'];
              break;
            case 'ctrl':
              modifier ^= Codes.modifierCodes['CTRL'];
              break;
            case 'leftalt':
              modifier ^= Codes.modifierCodes['LALT'];
              break;
            case 'rightalt':
              modifier ^= Codes.modifierCodes['RALT'];
              break;
            case 'alt':
              modifier ^= Codes.modifierCodes['ALT'];
              break;
            default:
              s = id;
          }

          // Combine our base modifiable layer and attach the new modifier variation info to obtain our destination layer.
          if(s != 'default') {
            if(s == '') {
              s = this.getLayerId(modifier);
            } else {
              s = this.getLayerId(modifier) + '-' + s;
            }
          }
        }
        
        if(s == '') {
          s = 'default';
        }
      } else {
        // Mobile form-factor.  Either the layout is specified by a keyboard developer with direct layer name references
        // or all layers are accessed via subkey of a single layer-shifting key - no need for modifier-combining logic.
        s = id;
      }

      // Actually set the new layer id.
      if(vkbd) {
        if(!vkbd.showLayer(s)) {
          vkbd.showLayer('default');
        }
      }
    }

    /**
     * Function     _GetEventKeyCode
     * Scope        Private
     * @param       {Event}       e         Event object
     * Description  Finds the key code represented by the event.
     */
    _GetEventKeyCode(e: KeyboardEvent) {
      if (e.keyCode) {
        return e.keyCode;
      } else if (e.which) {
        return e.which;
      } else {
        return null;
      }
    }

    // Returns true if the key event is a modifier press, allowing keyPress to return selectively
    // in those cases.
    private doModifierPress(Levent: KeyEvent, isKeyDown: boolean): boolean {
      let keyman = com.keyman.singleton;

      switch(Levent.Lcode) {
        case 8: 
          Processor.getOutputTarget(Levent.Ltarg).deadkeys().clear();
          break; // I3318 (always clear deadkeys after backspace) 
        case 16: //"K_SHIFT":16,"K_CONTROL":17,"K_ALT":18
        case 17: 
        case 18: 
        case 20: //"K_CAPS":20, "K_NUMLOCK":144,"K_SCROLL":145
        case 144:
        case 145:
          // For eventual integration - we bypass an OSK update for physical keystrokes when in touch mode.
          keyman.keyboardManager.notifyKeyboard(Levent.Lcode, Levent.Ltarg, 1); 
          if(!keyman.util.device.touchable) {
            return this._UpdateVKShift(Levent, Levent.Lcode-15, 1); // I2187
          } else {
            return true;
          }
      }

      if(Levent.LmodifierChange) {
        keyman.keyboardManager.notifyKeyboard(0, Levent.Ltarg, 1); 
        this._UpdateVKShift(Levent, 0, 1);
      }

      // No modifier keypresses detected.
      return false;
    }

    /**
     * Function     keyDown
     * Scope        Public
     * Description  Processes keydown event and passes data to keyboard. 
     * 
     * Note that the test-case oriented 'recorder' stubs this method to facilitate keystroke
     * recording for use in test cases.  If changing this function, please ensure the recorder is
     * not affected.
     */ 
    keyDown(e: KeyboardEvent): boolean {
      let keyman = com.keyman.singleton;
      let activeKeyboard = keyman.keyboardManager.activeKeyboard;
      let util = keyman.util;
      let kbdInterface = keyman['interface'];
      let keyMapManager = keyman.keyMapManager;

      this.swallowKeypress = false;

      // Get event properties  
      var Levent = this._GetKeyEventProperties(e, true);
      if(Levent == null) {
        return true;
      }

      if(this.doModifierPress(Levent, true)) {
        return true;
      }

      if(!window.event) {
        // I1466 - Convert the - keycode on mnemonic as well as positional layouts
        // FireFox, Mozilla Suite
        if(keyMapManager.browserMap.FF['k'+Levent.Lcode]) {
          Levent.Lcode=keyMapManager.browserMap.FF['k'+Levent.Lcode];
        }
      } //else 
      //{
      // Safari, IE, Opera?
      //}

      let outputTarget = Processor.getOutputTarget(Levent.Ltarg);
      
      if(!activeKeyboard['KM']) {
        // Positional Layout

        var LeventMatched=0;
        /* 13/03/2007 MCD: Swedish: Start mapping of keystroke to US keyboard */
        var Lbase=keyMapManager.languageMap[com.keyman.osk.Layouts._BaseLayout];
        if(Lbase && Lbase['k'+Levent.Lcode]) {
          Levent.Lcode=Lbase['k'+Levent.Lcode];
        }
        /* 13/03/2007 MCD: Swedish: End mapping of keystroke to US keyboard */
        
        if(typeof(activeKeyboard['KM'])=='undefined'  &&  !(Levent.Lmodifiers & 0x60)) {
          // Support version 1.0 KeymanWeb keyboards that do not define positional vs mnemonic
          var Levent2: LegacyKeyEvent = {
            Lcode: keyMapManager._USKeyCodeToCharCode(Levent),
            Ltarg: Levent.Ltarg,
            Lmodifiers: 0,
            LisVirtualKey: 0
          };

          if(kbdInterface.processKeystroke(util.physicalDevice, outputTarget, Levent2)) {
            LeventMatched=1;
          }
        }
        
        LeventMatched = LeventMatched || kbdInterface.processKeystroke(util.physicalDevice, outputTarget, Levent);
        
        // Support backspace in simulated input DIV from physical keyboard where not matched in rule  I3363 (Build 301)
        if(Levent.Lcode == 8 && !LeventMatched && Levent.Ltarg.className != null && Levent.Ltarg.className.indexOf('keymanweb-input') >= 0) {
          kbdInterface.defaultBackspace();
        }
      } else {
        // Mnemonic layout
        if(Levent.Lcode == 8) { // I1595 - Backspace for mnemonic
          this.swallowKeypress = true;
          if(!kbdInterface.processKeystroke(util.physicalDevice, outputTarget, Levent)) {
            kbdInterface.defaultBackspace(); // I3363 (Build 301)
          }
          return false;  //added 16/3/13 to fix double backspace on mnemonic layouts on desktop
        } else {
          this.swallowKeypress = false;
          LeventMatched = LeventMatched || kbdInterface.processKeystroke(util.physicalDevice, outputTarget, Levent);
        }
      }

      // Translate numpad keystrokes into their non-numpad equivalents
      if(!LeventMatched  &&  Levent.Lcode >= Codes.keyCodes["K_NP0"]  &&  Levent.Lcode <= Codes.keyCodes["K_NPSLASH"] && !activeKeyboard['KM']) {
        // Number pad, numlock on
        //      _Debug('KeyPress NumPad code='+Levent.Lcode+'; Ltarg='+Levent.Ltarg.tagName+'; LisVirtualKey='+Levent.LisVirtualKey+'; _KeyPressToSwallow='+keymanweb._KeyPressToSwallow+'; keyCode='+(e?e.keyCode:'nothing'));

        if(Levent.Lcode < 106) {
          var Lch = Levent.Lcode-48;
        } else {
          Lch = Levent.Lcode-64;
        }
        kbdInterface.output(0, outputTarget, String._kmwFromCharCode(Lch)); //I3319

        LeventMatched = 1;
      }

      // Should we swallow any further processing of keystroke events for this keydown-keypress sequence?
      if(LeventMatched) {
        if(e  &&  e.preventDefault) {
          e.preventDefault();
          e.stopPropagation();
        }
        
        this.swallowKeypress = (e ? this._GetEventKeyCode(e) != 0 : false);
        return false;
      } else {
        this.swallowKeypress = false;
      }
      
      // Special backspace handling.
      if(Levent.Lcode == 8) {
        /* Backspace - delete deadkeys, also special rule if desired? */
        // This is needed to prevent jumping to previous page, but why???  // I3363 (Build 301)
        if(Levent.Ltarg.className != null && Levent.Ltarg.className.indexOf('keymanweb-input') >= 0) {
          return false;
        }
      }

      // Default text output emulation (for simulated touch elements)
      if(typeof((Levent.Ltarg as HTMLElement).base) != 'undefined') {
        // Simulated touch elements have no default text-processing - we need to rely on a strategy similar to
        // that of the OSK here.
        var ch = this.defaultKeyOutput('', Levent.Lcode, Levent.Lmodifiers, false, Levent.Ltarg);
        if(ch) {
          kbdInterface.output(0, outputTarget, ch);
          return false;
        }
      }

      return true;
    }

    // KeyUp basically exists for two purposes:
    // 1)  To detect browser form submissions (handled in kmwdomevents.ts)
    // 2)  To detect modifier state changes.
    keyUp(e: KeyboardEvent): boolean {
      var Levent = this._GetKeyEventProperties(e, false);
      if(Levent == null) {
        return true;
      }

      return this.doModifierPress(Levent, false);
    }

    keyPress(e: KeyboardEvent): boolean {
      let keyman = com.keyman.singleton;

      var Levent = this._GetKeyEventProperties(e);
      if(Levent == null || Levent.LisVirtualKey) {
        return true;
      }

      // _Debug('KeyPress code='+Levent.Lcode+'; Ltarg='+Levent.Ltarg.tagName+'; LisVirtualKey='+Levent.LisVirtualKey+'; _KeyPressToSwallow='+keymanweb._KeyPressToSwallow+'; keyCode='+(e?e.keyCode:'nothing'));

      /* I732 START - 13/03/2007 MCD: Swedish: Start positional keyboard layout code: prevent keystroke */
      if(!keyman.keyboardManager.activeKeyboard['KM']) {
        if(!this.swallowKeypress) {
          return true;
        }
        if(Levent.Lcode < 0x20 || ((<any>keyman)._BrowserIsSafari  &&  (Levent.Lcode > 0xF700  &&  Levent.Lcode < 0xF900))) {
          return true;
        }

        e = keyman._GetEventObject<KeyboardEvent>(e);   // I2404 - Manage IE events in IFRAMEs
        if(e) {
          e.returnValue = false;
        }
        return false;
      }
      /* I732 END - 13/03/2007 MCD: Swedish: End positional keyboard layout code */
      let outputTarget = Processor.getOutputTarget(Levent.Ltarg);
      
      // Only reached if it's a mnemonic keyboard.
      if(this.swallowKeypress || keyman['interface'].processKeystroke(keyman.util.physicalDevice, outputTarget, Levent)) {
        this.swallowKeypress = false;
        if(e && e.preventDefault) {
          e.preventDefault();
          e.stopPropagation();
        }
        return false;
      }

      this.swallowKeypress = false;
      return true;
    }
  }
}