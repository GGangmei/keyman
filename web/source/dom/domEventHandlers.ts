/// <reference path="preProcessor.ts" />

namespace com.keyman.dom {
  /*
  * Note that for many of the actual events represented by methods in this file, `this` is replaced
  * automatically by JavaScript's event handling system.  As such, many 'wrapper' variants of the events
  * exist to restore the object-oriented hierarchy below.
  *
  */

  export class CommonDOMStates {
    _DisableInput: boolean = false;         // Should input be disabled?
    _IgnoreNextSelChange: number = 0;       // when a visual keyboard key is mouse-down, ignore the next sel change because this stuffs up our history
    _IgnoreBlurFocus: boolean = false;      // Used to temporarily ignore focus changes
    _Selection = null;
    _SelectionControl: any = null;   // Type behavior is as with activeElement and the like.

    _activeElement: HTMLElement;
    _lastActiveElement: HTMLElement;

    focusing: boolean;
    focusTimer: number;

    changed: boolean;         // Tracks if the element has been edited since gaining focus.
    swallowKeypress: boolean; // Notes if a keypress should be swallowed; used when handing mnemonics.

    /* ----------------------- Static event-related methods ------------------------ */

    setFocusTimer(): void {
      this.focusing=true;

      this.focusTimer = window.setTimeout(function() {
        this.focusing=false;
      }.bind(this), 50)
    }
  }

  /**
   * Declares a base, non-touch oriented implementation of all relevant DOM-related event handlers and state functions.
   */
  export class DOMEventHandlers {
    // TODO:  resolve/refactor out!
    protected keyman: KeymanBase;

    // This is only static within a given initialization of KeymanWeb.  Perhaps it would be best as an initialization
    // parameter and member field?
    static states: CommonDOMStates = new CommonDOMStates();

    constructor(keyman: KeymanBase) {
      this.keyman = keyman;
    }

    /**
     * Handle receiving focus by simulated input field
     */
    setFocus: (e?: TouchEvent) => void = function(e?: TouchEvent): void {
      // Touch-only handler.
    }.bind(this);

    /**
     * Handles touch-based loss of focus events.
     */
    setBlur: (e: FocusEvent) => void = function(e: FocusEvent) {
      // Touch-only handler.
    }.bind(this);

    // End of I3363 (Build 301) additions

    // Universal DOM event handlers (both desktop + touch)

    //TODO: add more complete description of what ControlFocus really does
    /**
     * Respond to KeymanWeb-aware input element receiving focus
     */
    _ControlFocus: (e: FocusEvent) => boolean = function(this: DOMEventHandlers, e: FocusEvent): boolean {
      var Ltarg: HTMLElement;
      var device = this.keyman.util.device;

      Ltarg = this.keyman.util.eventTarget(e) as HTMLElement;
      if (Ltarg == null) {
        return true;
      }

      if(Ltarg['body']) {
        Ltarg = Ltarg['body']; // Occurs in Firefox for design-mode iframes.
      }

      // Prevent any action if a protected input field
      if(device.touchable && (Ltarg.className == null || Ltarg.className.indexOf('keymanweb-input') < 0)) {
        return true;
      }

      // Or if not a remappable input field
      var en=Ltarg.nodeName.toLowerCase();
      if(Ltarg.ownerDocument && Ltarg instanceof Ltarg.ownerDocument.defaultView.HTMLInputElement) {
        var et=Ltarg.type.toLowerCase();
        if(!(et == 'text' || et == 'search')) {
          return true;
        }
      } else if(Ltarg.ownerDocument && Ltarg.ownerDocument.designMode == 'on') {
        // continue; don't block this one!
      } else if((device.touchable || !Ltarg.isContentEditable)
          && !(Ltarg.ownerDocument && Ltarg instanceof Ltarg.ownerDocument.defaultView.HTMLTextAreaElement)) {
        return true;
      }

      // We condition on 'priorElement' below as a check to allow KMW to set a default active keyboard.
      var priorElement = DOMEventHandlers.states._lastActiveElement;

      if (Ltarg.nodeType == 3) { // defeat Safari bug
        Ltarg = Ltarg.parentNode as HTMLElement;
      }

      var LfocusTarg = Ltarg;

      // Ensure that focussed element is visible above the keyboard
      if(Ltarg.className == null || Ltarg.className.indexOf('keymanweb-input') < 0) {
        if(this instanceof DOMTouchHandlers) {
          (this as DOMTouchHandlers).scrollBody(Ltarg);
        }
      }

      if(Ltarg.ownerDocument && Ltarg instanceof Ltarg.ownerDocument.defaultView.HTMLIFrameElement) { //**TODO: check case reference
        this.keyman.domManager._AttachToIframe(Ltarg as HTMLIFrameElement);
        Ltarg=Ltarg.contentWindow.document.body;
      }

      // Must set before _Blur / _Focus to avoid infinite recursion due to complications
      // in setActiveKeyboard behavior with managed keyboard settings.
      this.keyman.domManager.lastActiveElement = Ltarg;
      this.keyman.domManager.activeElement = Ltarg;  // I3363 (Build 301)

      if(this.keyman.uiManager.justActivated) {
        this._BlurKeyboardSettings(Ltarg);
      } else {
        this._FocusKeyboardSettings(Ltarg, priorElement ? false : true);
      }

      // Always do the common focus stuff, instantly returning if we're in an editable iframe.
      if(this._CommonFocusHelper(Ltarg)) {
        return true;
      };

      // Set element directionality (but only if element is empty)
      if(Ltarg.ownerDocument && Ltarg instanceof Ltarg.ownerDocument.defaultView.HTMLElement) {
        this.keyman.domManager._SetTargDir(Ltarg);
      }

      //Execute external (UI) code needed on focus if required
      this.doControlFocused(LfocusTarg, this.keyman.domManager.lastActiveElement);

      return true;
    }.bind(this);

    /**
     * Function     doControlFocused
     * Scope        Private
     * @param       {Object}            _target         element gaining focus
     * @param       {Object}            _activeControl  currently active control
     * @return      {boolean}
     * Description  Execute external (UI) code needed on focus
     */
    doControlFocused(_target: HTMLElement, _activeControl: HTMLElement): boolean {
      var p={};
      p['target']=_target;
      p['activeControl']=_activeControl;

      return this.keyman.util.callEvent('kmw.controlfocused',p);
    }

    /**
     * Respond to KMW losing focus on event
     */
    _ControlBlur: (e: FocusEvent) => boolean = function(this: DOMEventHandlers, e: FocusEvent): boolean {
      let Ltarg = this.keyman.util.eventTarget(e) as HTMLElement;
      if (Ltarg == null) {
        return true;
      }

      if(Ltarg['body']) {
        Ltarg = Ltarg['body']; // Occurs in Firefox for design-mode iframes.
      }

      if(DOMEventHandlers.states._IgnoreNextSelChange) {
        // If a keyboard calls saveFocus() (KSF), then ignore the
        // next selection change
        DOMEventHandlers.states._IgnoreNextSelChange--;
        e.cancelBubble = true;
        e.stopPropagation();
        return true;
      }

      if(DOMEventHandlers.states._IgnoreBlurFocus) {
        // Prevent triggering other blur-handling events (as possible)
        e.cancelBubble = true;
        e.stopPropagation();
        return true;
      }

      if (Ltarg.nodeType == 3) { // defeat Safari bug
        Ltarg = Ltarg.parentNode as HTMLElement;
      }

      if(Ltarg.ownerDocument) {
        if(Ltarg instanceof Ltarg.ownerDocument.defaultView.HTMLIFrameElement) {
          Ltarg=Ltarg.contentWindow.frameElement as HTMLElement;
        }
      }

      ////keymanweb._SelectionControl = null;
      if(this.keyman.domManager.lastActiveElement) {
        this._BlurKeyboardSettings(this.keyman.domManager.lastActiveElement);
      }

      // Now that we've handled all prior-element maintenance, update the active and 'last-active element'.
      this.keyman.domManager.activeElement = null; // I3363 (Build 301)
      this.keyman.domManager.lastActiveElement = Ltarg;

      /* If the KeymanWeb UI is active as a user changes controls, all UI-based effects should be restrained to this control in case
      * the user is manually specifying languages on a per-control basis.
      */
      this.keyman.uiManager.justActivated = false;

      var isActivating = this.keyman.uiManager.isActivating;
      let activeKeyboard = com.keyman.singleton.core.activeKeyboard;
      if(!isActivating && activeKeyboard) {
        activeKeyboard.notify(0, Utils.getOutputTarget(Ltarg as HTMLElement), 0);  // I2187
      }

      this.doControlBlurred(Ltarg, e, isActivating);

      this.doChangeEvent(Ltarg);
      this.keyman['resetContext']();

      return true;
    }.bind(this);

    /**
     * Function     doControlBlurred
     * Scope        Private
     * @param       {Object}            _target       element losing focus
     * @param       {Event}             _event        event object
     * @param       {(boolean|number)}  _isActivating activation state
     * @return      {boolean}
     * Description  Execute external (UI) code needed on blur
     */
    doControlBlurred(_target: HTMLElement, _event: Event, _isActivating: boolean|number): boolean {
      var p={};
      p['target']=_target;
      p['event']=_event;
      p['isActivating']=_isActivating;

      return this.keyman.util.callEvent('kmw.controlblurred',p);
    }

    /**
     * Function             _BlurKeyboardSettings
     * Description          Stores the last active element's keyboard settings.  Should be called
     *                      whenever a KMW-enabled page element loses control.
     */
    _BlurKeyboardSettings(lastElem: HTMLElement, PInternalName?: string, PLgCode?: string) {
      var keyboardID = this.keyman.core.activeKeyboard ? this.keyman.core.activeKeyboard.id : '';
      var langCode = this.keyman.keyboardManager.getActiveLanguage();

      if(PInternalName !== undefined && PLgCode !== undefined) {
        keyboardID = PInternalName;
        langCode = PLgCode;
      }

      if(lastElem && lastElem._kmwAttachment.keyboard != null) {
        lastElem._kmwAttachment.keyboard = keyboardID;
        lastElem._kmwAttachment.languageCode = langCode;
      } else {
        this.keyman.globalKeyboard = keyboardID;
        this.keyman.globalLanguageCode = langCode;
      }
    }

    /**
     * Function             _FocusKeyboardSettings
     * @param   {boolean}   blockGlobalChange   A flag indicating if the global keyboard setting should be ignored for this call.
     * Description          Restores the newly active element's keyboard settings.  Should be called
     *                      whenever a KMW-enabled page element gains control, but only once the prior
     *                      element's loss of control is guaranteed.
     */
    _FocusKeyboardSettings(lastElem: HTMLElement, blockGlobalChange: boolean) {
      if(lastElem && lastElem._kmwAttachment.keyboard != null) {
        this.keyman.keyboardManager.setActiveKeyboard(lastElem._kmwAttachment.keyboard,
          lastElem._kmwAttachment.languageCode);
      } else if(!blockGlobalChange) {
        this.keyman.keyboardManager.setActiveKeyboard(this.keyman.globalKeyboard, this.keyman.globalLanguageCode);
      }

       // Now that we've fully entered the new context, invalidate the context so we can generate initial predictions from it.
      if(this.keyman.modelManager) {
        let outputTarget = dom.Utils.getOutputTarget(lastElem);
        this.keyman.core.languageProcessor.invalidateContext(outputTarget, this.keyman.core.keyboardProcessor?.layerId);
      }
    }

    /**
     * Function             _CommonFocusHelper
     * @param   {Element}   target
     * @returns {boolean}
     * Description          Performs common state management for the various focus events of KeymanWeb.
     *                      The return value indicates whether (true) or not (false) the calling event handler
     *                      should be terminated immediately after the call.
     */
    _CommonFocusHelper(target: HTMLElement): boolean {
      let keyman = com.keyman.singleton;
      var uiManager = this.keyman.uiManager;

      if(target.ownerDocument && target instanceof target.ownerDocument.defaultView.HTMLIFrameElement) {
        if(!this.keyman.domManager._IsEditableIframe(target, 1)) {
          DOMEventHandlers.states._DisableInput = true;
          return true;
        }
      }
      DOMEventHandlers.states._DisableInput = false;

      const outputTarget = dom.Utils.getOutputTarget(target);

      let activeKeyboard = keyman.core.activeKeyboard;
      if(!uiManager.justActivated) {
        if(target && outputTarget) {
          outputTarget.deadkeys().clear();
        }

        if(activeKeyboard) {
          activeKeyboard.notify(0, outputTarget, 1);  // I2187
        }
      }

      if(!uiManager.justActivated && DOMEventHandlers.states._SelectionControl != target) {
        uiManager.isActivating = false;
      }
      uiManager.justActivated = false;

      DOMEventHandlers.states._SelectionControl = target;

      if(target && outputTarget) {
        // Call the current keyboard's newContext handler;
        // timeout is required in order to get the current
        // selection, which is not ready at time of focus event,
        // at least on Chrome
        window.setTimeout(() => {
          //console.log('processNewContextEvent called from focus');
          com.keyman.singleton.core.processNewContextEvent(outputTarget);
        });
      }

      if(keyman.core.languageProcessor.isActive) {
        keyman.core.languageProcessor.predictFromTarget(outputTarget, keyman.core.keyboardProcessor?.layerId);
      }
      return false;
    }

    /**
     * Function     _KeyDown
     * Scope        Private
     * Description  Processes keydown event and passes data to keyboard.
     *
     * Note that the test-case oriented 'recorder' stubs this method to facilitate keystroke
     * recording for use in test cases.  If changing this function, please ensure the recorder is
     * not affected.
     */
    _KeyDown: (e: KeyboardEvent) => boolean = function(this: DOMEventHandlers, e: KeyboardEvent): boolean {
      var activeKeyboard = this.keyman.core.activeKeyboard;
      var util = this.keyman.util;

      if(DOMEventHandlers.states._DisableInput || activeKeyboard == null) {
        return true;
      }

      // Prevent mapping element is readonly or tagged as kmw-disabled
      var el=util.eventTarget(e) as HTMLElement;
      if(util.device.touchable) {
        if(el && typeof el.kmwInput != 'undefined' && el.kmwInput == false) {
          return true;
        }
      } else if(el && el.className.indexOf('kmw-disabled') >= 0) {
        return true;
      }

      return PreProcessor.keyDown(e);
    }.bind(this);

    doChangeEvent(_target: HTMLElement) {
      if(DOMEventHandlers.states.changed) {
        let event = new Event('change', {"bubbles": true, "cancelable": false});
        _target.dispatchEvent(event);
      }

      DOMEventHandlers.states.changed = false;
    }

    _Click: (e: MouseEvent) => boolean = function(this: DOMEventHandlers, e: MouseEvent): boolean {
      let target = e.target as HTMLElement;
      if(target && target['base']) {
        target = target['base'];
      }

      //console.log('processNewContextEvent called from click');
      com.keyman.singleton.core.processNewContextEvent(dom.Utils.getOutputTarget(target));

      return true;
    }.bind(this);

    /**
     * Function     _KeyPress
     * Scope        Private
     * Description Processes keypress event (does not pass data to keyboard)
     */
    _KeyPress: (e: KeyboardEvent) => boolean = function(this: DOMEventHandlers, e: KeyboardEvent): boolean {
      if(DOMEventHandlers.states._DisableInput || this.keyman.core.activeKeyboard == null) {
        return true;
      }

      return PreProcessor.keyPress(e);
    }.bind(this);

    /**
     * Function     _KeyUp
     * Scope        Private
     * Description Processes keyup event and passes event data to keyboard
     */
    _KeyUp: (e: KeyboardEvent) => boolean = function(this: DOMEventHandlers, e: KeyboardEvent): boolean {
      var osk = this.keyman.osk;

      var Levent = PreProcessor._GetKeyEventProperties(e, false);
      if(Levent == null) {
        return true;
      }

      let outputTarget = PreProcessor.getEventOutputTarget(e) as dom.targets.OutputTarget;
      var inputEle = outputTarget.getElement();

      // Since this part concerns DOM element + browser interaction management, we preprocess it for
      // browser form commands before passing control to the Processor module.
      if(Levent.Lcode == 13) {
        var ignore = false;
        if(outputTarget instanceof inputEle.ownerDocument.defaultView.HTMLTextAreaElement) {
          ignore = true;
        }

        if(inputEle.base && inputEle.base instanceof inputEle.base.ownerDocument.defaultView.HTMLTextAreaElement) {
          ignore = true;
        }

        if(!ignore) {
          // For input fields, move to next input element
          if(inputEle instanceof inputEle.ownerDocument.defaultView.HTMLInputElement) {
            if(inputEle.type == 'search' || inputEle.type == 'submit') {
              inputEle.form.submit();
            } else {
              this.keyman.domManager.moveToNext(false);
            }
          }
          return true;
        }
      }

      return PreProcessor.keyUp(e);
    }.bind(this);
  }

  // -------------------------------------------------------------------------

  /**
   * Defines numerous functions for handling and modeling touch-based aliases.
   */
  export class DOMTouchHandlers extends DOMEventHandlers {
    firstTouch: {
      x: number;
      y: number;
    };


    constructor(keyman: KeymanBase) {
      super(keyman);
    }

    private static selectTouch(e: TouchEvent): Touch {
      // The event at least tells us the event's target, which can be used to help check
      // whether or not individual `Touch`es may be related to this specific event for
      // an ongoing multitouch scenario.
      let target = e.target;

      // Find the first touch affected by this event that matches the current target.
      for(let i=0; i < e.changedTouches.length; i++) {
        if(e.changedTouches[i].target == target) {
          return e.changedTouches[i];
        }
      }

      // Shouldn't be possible.  Just in case, we'd prefer a silent failure that allows
      // callers to silently abort.
      throw new Error("Could not select valid Touch for event.");
    }

    /**
     * Handle receiving focus by simulated input field
     */
    setFocus: (e?: TouchEvent) => void = function(this: DOMTouchHandlers, e?: TouchEvent): void {
      DOMEventHandlers.states.setFocusTimer();

      var tEvent: {
        pageX: number;
        pageY: number;
        target?: EventTarget;
      };

      if(e && dom.Utils.instanceof(e, "TouchEvent")) {
        try {
          tEvent=DOMTouchHandlers.selectTouch(e as TouchEvent);
        } catch(err) {
          console.warn(err);
          return;
        }
      } else { // Allow external code to set focus and thus display the OSK on touch devices if required (KMEW-123)
        tEvent={pageX:0, pageY:0}

        // Will usually be called from setActiveElement, which should define DOMEventHandlers.states.lastActiveElement
        if(this.keyman.domManager.lastActiveElement) {
          tEvent.target = this.keyman.domManager.lastActiveElement;
        // but will default to first input or text area on page if DOMEventHandlers.states.lastActiveElement is null
        } else {
          tEvent.target = this.keyman.domManager.sortedInputs[0];
        }
      }

      this.setFocusWithTouch(tEvent);
    }.bind(this);

    // Also handles initial touch responses.
    setFocusWithTouch(tEvent: {pageX: number, pageY: number, target?: EventTarget}) {
      let target=tEvent.target as HTMLElement;

      if(target['body']) {
        target = target['body']; // Occurs in Firefox for design-mode iframes.
      }

      // Correct element directionality if required
      this.keyman.domManager._SetTargDir(target);

      // Move the caret and refocus if necessary
      if(this.keyman.domManager.activeElement != target) {
        this.keyman.domManager.activeElement = target;
      }

      /*
       * This event will trigger before keymanweb.setBlur is triggered.  Now that we're allowing independent keyboard settings
       * for controls, we have to act here to preserve the outgoing control's keyboard settings.
       *
       * If we 'just activated' the KeymanWeb UI, we need to save the new keyboard change as appropriate.
       */
      if(this.keyman.domManager.lastActiveElement) {
        this._BlurKeyboardSettings(this.keyman.domManager.lastActiveElement);
      }

      // With the attachment API update, we now directly track the old legacy control behavior.
      this.keyman.domManager.lastActiveElement = target;

      /*
       * If we 'just activated' the KeymanWeb UI, we need to save the new keyboard change as appropriate.
       * If not, we need to activate the control's preferred keyboard.
       */

      DOMEventHandlers.states._IgnoreBlurFocus = true;      // Used to temporarily ignore focus changes
      this._FocusKeyboardSettings(target, false);
      DOMEventHandlers.states._IgnoreBlurFocus = false;     // Used to temporarily ignore focus changes

      // Always do the common focus stuff, instantly returning if we're in an editable iframe.
      // This parallels the if-statement in _ControlFocus - it may be needed as this if-statement in the future,
      // despite its present redundancy.
      if(this._CommonFocusHelper(target)) {
        return;
      }
    }

    /**
     * Close OSK and remove simulated caret on losing focus
     */
    cancelInput(): void {
      this.keyman.domManager.activeElement = null;
      this.keyman.domManager.lastActiveElement = null;
      this.keyman.osk.hideNow();
    };

    /**
     * Handle losing focus from simulated input field
     */
    setBlur: (e: FocusEvent) => void = function(this: DOMTouchHandlers, e: FocusEvent) {
      // This works OK for iOS, but may need something else for other platforms
      var elem: HTMLElement;

      if(('relatedTarget' in e) && e.relatedTarget) {
        elem = e.relatedTarget as HTMLElement;
      }

      if(elem['body']) {
        elem = elem['body']; // Occurs in Firefox for design-mode iframes.
      }

      this.executeBlur(elem);
    }.bind(this);

    executeBlur(elem: HTMLElement) {
      this.keyman['resetContext']();

      if(elem) {
        this.doChangeEvent(elem);
        if(elem.nodeName != 'DIV' || elem.className.indexOf('keymanweb-input') == -1) {
          this.cancelInput();
          return;
        }
      }

      //Hide the OSK
      if(!DOMEventHandlers.states.focusing && !this.keyman.uiManager.justActivated) {
        this.cancelInput();
      }
    }

    /**
     * Display and position a scrollbar in the input field if needed
     *
     * @param   {Object}  e   input DIV element (copy of INPUT or TEXTAREA)
     */
    setScrollBar(e: HTMLElement) {
      // Display the scrollbar if necessary.  Added TEXTAREA condition to correct rotation issue KMW-5.  Fixed for 310 beta.
      var scroller=<HTMLElement>e.childNodes[0], sbs=(<HTMLElement>e.childNodes[1]).style;
      if((scroller.offsetWidth > e.offsetWidth || scroller.offsetLeft < 0) && (e.base.nodeName != 'TEXTAREA')) {
        sbs.height='4px';
        sbs.width=100*(e.offsetWidth/scroller.offsetWidth)+'%';
        sbs.left=100*(-scroller.offsetLeft/scroller.offsetWidth)+'%';
        sbs.top='0';
        sbs.visibility='visible';
      } else if(scroller.offsetHeight > e.offsetHeight || scroller.offsetTop < 0) {
        sbs.width='4px';
        sbs.height=100*(e.offsetHeight/scroller.offsetHeight)+'%';
        sbs.top=100*(-scroller.offsetTop/scroller.offsetHeight)+'%';
        sbs.left='0';
        sbs.visibility='visible';
      } else {
        sbs.visibility='hidden';
      }
    }

    /**
     * Handle the touch end event for an input element
     */
    dragEnd: (e: TouchEvent) => void = function(this: DOMTouchHandlers, e: TouchEvent) {
      e.stopPropagation();
      this.firstTouch = null;
    }.bind(this);

    /**
     * Scroll the document body vertically to bring the active input into view
     *
     * @param       {Object}      e        simulated input field object being focussed
     */
    scrollBody(e: HTMLElement): void {
      var osk = this.keyman.osk;

      if(!e || e.className == null || e.className.indexOf('keymanweb-input') < 0 || !osk) {
        return;
      }

      // Get the absolute position of the caret
      var s2=<HTMLElement>e.firstChild.childNodes[1], y=dom.Utils.getAbsoluteY(s2), t=window.pageYOffset,dy=0;
      if(y < t) {
        dy=y-t;
      } else {
        dy=y-t-(window.innerHeight-osk._Box.offsetHeight-s2.offsetHeight-2);
        if(dy < 0) dy=0;
      }
      // Hide OSK, then scroll, then re-anchor OSK with absolute position (on end of scroll event)
      if(dy != 0) {
        window.scrollTo(0,dy+window.pageYOffset);
      }
    }
  }
}
