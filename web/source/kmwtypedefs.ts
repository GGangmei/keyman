namespace com.keyman {
  export class AttachmentInfo {
    /**
     * Tracks the control's independent keyboard selection, when applicable.
     */
    keyboard:       string;

    /**
     * Tracks the language code corresponding to the `keyboard` field.
     */
    languageCode:   string;

    /**
     * Tracks if the control has an aliased control for touch functionality.
     * 
     * Future note - could be changed to track the DOMEventHandler instance used by this control;
     *               this may be useful for an eventual hybrid touch/non-touch implementation.
     */
    touchEnabled:   boolean;

    constructor(kbd: string, touch: boolean) {
      this.keyboard = kbd;
      this.touchEnabled = touch;
    }
  }

  export class StyleCommand {
    cmd: string;
    state: number;

    constructor(c: string, s:number) {
      this.cmd = c;
      this.state = s;
    }
  }
}