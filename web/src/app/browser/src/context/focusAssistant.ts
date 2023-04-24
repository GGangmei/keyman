/**
 * The return object documented for
 * https://help.keyman.com/developer/engine/web/16.0/reference/core/getUIState.
 *
 * As it has long been documented in this format, property names should not be adjusted!
 */
export class FocusStateAPIObject {
  /**
   * Indicates that KMW is in a state of actively restoring focus to a previously-active element.
   */
  activated: boolean;

  /**
   * Indicates that KMW is actively maintaining focus on the currently active OutputTarget control
   * while some UI element (the OSK, a keyboard-change UI) is the current focus of user-interaction.
   */
  activationPending: boolean;

  constructor(pending: boolean, activated: boolean) {
    this.activationPending = pending;
    this.activated = activated;
  }
}

// Formerly handled under "UIManager".
/**
 * This class provides fields and methods useful for assisting context management.  Control focus (and
 * thus, activation of the corresponding OutputTarget) should not be lost to non-context components of
 * KMW, such as the OSK or a keyboard selector.
 */
export class FocusAssistant {
  /*
   * Long-term idea here: about all of the relevant OSK events that would interact with this have "enter" and
   * "leave" variants - we could take a stack of `Promise`s.  On a `Promise` fulfillment, remove it from the
   * stack.  When the last one is removed, the focus-maintenance state would end, allowing further events
   * to deactivate the active OutputTarget.
   */

  /**
   * Indicates that KMW is actively maintaining focus on the currently active OutputTarget control, rather
   * than losing focus while some UI element (the OSK, a keyboard-change UI) is the most direct recipient
   * of browser focus due to user-interaction - generally, with non-context engine components.
   *
   * While the flag is active, the context-management system should not deactivate an OutputTarget upon
   * its element's loss of focus within the page unless setting a different OutputTarget as active.
   */
  // Formerly `isActivating`.
  maintainingFocus: boolean = false;    // ActivatingKeymanWebUI - Does the OSK have active focus / an active interaction?

  /*
   * Long-term idea here:  as (aside from OSK title/resize bar interactions) it's always used to actively
   * RESTORE focus, taking in a closure to perform during the 'focus restoration state' would make a nice
   * design.  Something like .performRefocus(closure: () => void):
   * - would set this field before calling the closure
   * - would unset this field after calling the closure
   * - would try-catch to guarantee the 'unset'.
   *
   * OSK drag handlers should utilize the other field, anyway.
   */

  /**
   * Indicates that KMW is in a state of actively restoring focus to a previously-active element.
   * This is most commonly utilized whenever a keyboard is newly activated, generally due to
   * user interaction to select the new keyboard.
   */
  // Formerly `justActivated`.
  restoringFocus: boolean = false;   // JustActivatedKeymanWebUI - focussing back to control after KeymanWeb UI interaction

  /**
   * JH (2023-04-24): given how it's used within the KMW engine, this seems extremely similar in purpose to
   * `restoringFocus` - it's set before calling an element's focus method to prevent focus-handlers from causing
   * unwanted side-effects.  The ONE critical detail:  KSF / `saveFocus` will block a single check, not waiting for
   * control flow restoration before clearing, where the other matching cases will block 100 (maybe to prevent
   * some sort of event softlock?).
   *
   * So, it's like the `saveFocus` variant immediately clears the flag once checked, while others are intended
   * to only clear the flag once control returns to the method that triggered a focus op.
   *
   * A future refactor should be able to merge the two, though it's worth noting that there are early checks for
   * this, but _not_ `restoringFocus`, in the context-management control-blur event handler.  So, it's not 100%
   * super-straightforward, but a refactor should be manageable all the same.
   */
  _IgnoreNextSelChange = 0;

  /**
   * JH (2023-04-24): Set only by the OutputTarget `forceScroll` method, which deliberately blurs and
   * then refocuses the same element in order to force a browser-default page scroll to keep the element
   * visible.
   *
   * While it feels like this should be possible to merge with the other class fields in some form... it
   * doesn't seem as safe to do on first glance.
   */
  _IgnoreBlurFocus: boolean = false;

  constructor() {
  }

  /**
   * Function     getUIState
   * Scope        Public
   * @return      {Object.<string,boolean>}
   * Description  Return object with activation state of UI:
   *                activationPending (bool):   KMW being activated
   *                activated         (bool):   KMW active
   */
  getUIState(): FocusStateAPIObject {
    return new FocusStateAPIObject(this.maintainingFocus, this.restoringFocus);
  }

  /**
   * Set or clear the IsActivatingKeymanWebUI flag (exposed function)
   *
   * @param       {(boolean|number)}  state  Activate (true,false)
   */
  setMaintainingFocus(state: boolean) {
    this.maintainingFocus = state ? true : false;
  }
}