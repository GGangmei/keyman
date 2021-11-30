/// <reference path="../pendingGesture.interface.ts" />
/// <reference path="../visualKeyboard.ts" />

namespace com.keyman.osk {

  export enum PendingMultiTapState { Waiting, Realized, Cancelled };
  /**
   * Implements the multi-tap gesture, which is a series of taps on a single key
   * (based on key id substring in the case of the shift key), within a
   * specified timeout period.
   */
  export class PendingMultiTap implements PendingGesture {
    public readonly vkbd: VisualKeyboard;
    public readonly baseKey: KeyElement;
    public readonly count: number;
    private timerId;
    private _touches = 1; // we start the multitap with a single touch
    private _state: PendingMultiTapState = PendingMultiTapState.Waiting;
    private _timeout: Promise<void>;
    private cancelDelayFactor = 125; // 125msec * count

    public get timeout() {
      return this._timeout;
    }
    public get realized() {
      return this._state == PendingMultiTapState.Realized;
    }
    public get cancelled() {
      return this._state == PendingMultiTapState.Cancelled;
    }

    /**
     * Construct a record of a potential multitap gesture
     * @param vkbd
     * @param baseKey   key which is being tapped
     * @param count     number of taps required to finalize this gesture
     */
    constructor(vkbd: VisualKeyboard, baseKey: KeyElement, count: number) {
      this.vkbd = vkbd;
      this.count = count;
      this.baseKey = baseKey;

      const _this = this;
      this._timeout = new Promise<void>(function(resolve) {
        // If multiple taps do not occur within the timeout window,
        // then we will abandon the gesture
        _this.timerId = window.setTimeout(() => {
          _this.cancel();
          _this.timerId = null;
          resolve();
        }, _this.cancelDelayFactor * _this.count);
      });
    }

    public static isValidTarget(vkbd: VisualKeyboard, baseKey: KeyElement) {
      return (
        baseKey['keyId'].includes('K_SHIFT') &&
        vkbd.layerGroup.layers['caps'] &&
        !baseKey['subKeys'] &&
        vkbd.touchCount == 1
      );
    }

    private cleanup(): void {
      if(this.timerId) {
        window.clearTimeout(this.timerId);
      }
      this.timerId = null;
    }

    /**
     * Cancel a pending multitap gesture
     */
    public cancel(): void {
      this._state = PendingMultiTapState.Cancelled;
      this.cleanup();
    }

    /**
     * Increments the touch counter for the gesture, and
     * if the touch count is reached, realize the gesture
     * @returns new state of the gesture
     */
    public incrementTouch(newKey: KeyElement): PendingMultiTapState {
      // TODO: support for any key
      if(this._state == PendingMultiTapState.Waiting) {
        if(!newKey['keyId'].includes('K_SHIFT')) {
          this.cancel();
        }
        else if(++this._touches == this.count) {
          this.realize();
        }
      }
      return this._state;
    }

    /**
     * Realize the gesture. In Keyman 15, this supports only
     * the Caps double-tap gesture on the Shift key.
     */
    public realize(): void {
      if(this._state != PendingMultiTapState.Waiting) {
        return;
      }
      this._state = PendingMultiTapState.Realized;
      this.cleanup();

      // In Keyman 15, only the K_SHIFT key supports multi-tap, so we can hack
      // in the switch to the caps layer.
      //
      // TODO: generalize this with double-tap key properties in touch layout
      //       description.
      let e = text.KeyEvent.constructNullKeyEvent(this.vkbd.device);
      e.kNextLayer = 'caps';
      PreProcessor.raiseKeyEvent(e);
    }
  }
}