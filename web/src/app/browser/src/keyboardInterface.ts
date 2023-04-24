import { KeyboardKeymanGlobal } from '@keymanapp/keyboard-processor';
import { StubAndKeyboardCache } from 'keyman/engine/package-cache';
import { type OutputTarget } from 'keyman/engine/element-wrappers';
import { FloatingOSKView, OSKView } from 'keyman/engine/osk';
import { KeyboardInterface as KeyboardInterfaceBase } from 'keyman/engine/main';

import ContextManager from './contextManager.js';

export default class KeyboardInterface extends KeyboardInterfaceBase<ContextManager> {
  // TBD:  allowing it to be set and/or the retrieval mechanism.
  //       Note that the OSK is constructed notably later, after page load + during full engine init.
  //       So, the actual instance will not be available at construction-time.
  private osk: OSKView; // Or some way to retrieve it.


  constructor(
    _jsGlobal: any,
    keymanGlobal: KeyboardKeymanGlobal,
    contextManager: ContextManager,
  ) {
    super(_jsGlobal, keymanGlobal, contextManager);

    // Nothing else to do here... quite yet.  Things may not stay that way, though.
  }
  // *** The following are quite useful for website-integrating KMW, but not needed for the embedded form. ***

  /**
   * Function     KSF
   * Scope        Public
   * Description  Save keyboard focus
   */
  saveFocus(): void {
    this.contextManager.focusAssistant._IgnoreNextSelChange = 1;
  }

  /**
   * Legacy entry points (non-standard names)- included only to allow existing IME keyboards to continue to be used
   */
  getLastActiveElement(): OutputTarget<any> {
    return this.contextManager.lastActiveTarget;
  }

  focusLastActiveElement(): void {
    this.contextManager.restoreLastActiveTarget();
  }

  //The following entry points are defined but should not normally be used in a keyboard, as OSK display is no longer determined by the keyboard
  hideHelp(): void {
    const osk = this.osk;
    osk.startHide(true);
  }

  showHelp(Px: number, Py: number): void {
    const osk = this.osk;

    if(osk instanceof FloatingOSKView) {
      osk.presentAtPosition(Px,Py);
    } else {
      osk.present();
    }
  }

  showPinnedHelp(): void {
    const osk = this.osk;

    if(osk instanceof FloatingOSKView) {
      // An old KMW bug previously auto-unset the affected field when this function was
      // used by CJK keyboards during rule processing.  As a result, we need to condition
      // on whether or not:
      // 1.  The active keyboard is CJK
      // 2.  A keyboard rule is actively processing.
      //
      // If BOTH are true, we do NOT mutate keyman.osk.userPositioned.
      // Otherwise, not all conditions are met, so we still allow OSK pinning.
      if(!osk.activeKeyboard.keyboard.isCJK || !this.ruleBehavior) {
        osk.userPositioned=true;
      }
    }
    // Automatically reuses previously-set positioning.
    // Other OSK API functions must have previously been used to set the
    // pinned position.
    osk.present();
  }

  // Also needed for some legacy CJK keyboards.
  readonly GetLastActiveElement = this.getLastActiveElement;
  readonly FocusLastActiveElement = this.focusLastActiveElement;
  readonly HideHelp = this.hideHelp;
  readonly ShowHelp = this.showHelp;
  readonly ShowPinnedHelp = this.showPinnedHelp;
}

(function() {
  // Update the shorthand API; we did just rewrite KSF / `saveFocus`.
  KeyboardInterface.__publishShorthandAPI();
})();