import { ActiveKey, ActiveLayer, ActiveRow } from '@keymanapp/keyboard-processor';

import OSKBaseKey from './oskBaseKey.js';
import { ParsedLengthStyle } from '../lengthStyle.js';
import VisualKeyboard from '../visualKeyboard.js';
import { KeyLayoutParams } from './oskKey.js';
import { LayerLayoutParams } from './oskLayer.js';

/**
 * Models one row of one layer of the OSK (`VisualKeyboard`) for a keyboard.
 */
export default class OSKRow {
  public readonly element: HTMLDivElement;
  public readonly keys: OSKBaseKey[];
  public readonly heightFraction: number;
  public readonly spec: ActiveRow;

  public constructor(vkbd: VisualKeyboard,
                      layerSpec: ActiveLayer,
                      rowSpec: ActiveRow) {
    const rDiv = this.element = document.createElement('div');
    rDiv.className='kmw-key-row';

    // Calculate default row height
    this.heightFraction = 1 / layerSpec.row.length;

    // Apply defaults, setting the width and other undefined properties for each key
    const keys=rowSpec.key;
    this.spec = rowSpec;
    this.keys = [];

    // Calculate actual key widths by multiplying by the OSK's width and rounding appropriately,
    // adjusting the width of the last key to make the total exactly 100%.
    // Overwrite the previously-computed percent.
    // NB: the 'percent' suffix is historical, units are percent on desktop devices, but pixels on touch devices
    // All key widths and paddings are rounded for uniformity
    for(let j=0; j<keys.length; j++) {
      const key = keys[j];
      var keyObj = new OSKBaseKey(key as ActiveKey, layerSpec.id, this);

      var element = keyObj.construct(vkbd);
      this.keys.push(keyObj);

      rDiv.appendChild(element);
    }
  }

  public get displaysKeyCaps(): boolean {
    if(this.keys.length > 0) {
      return this.keys[0].displaysKeyCap;
    } else {
      return undefined;
    }
  }

  public set displaysKeyCaps(flag: boolean) {
    for(const key of this.keys) {
      key.displaysKeyCap = flag;
    }
  }

  public refreshLayout(layoutParams: LayerLayoutParams) {
    const rs = this.element.style;

    const rowHeight = layoutParams.heightStyle.scaledBy(this.heightFraction);
    const executeRowStyleUpdates = () => {
      rs.maxHeight=rs.lineHeight=rs.height=rowHeight.styleString;
    }

    // Only used for fixed-height scales at present.
    const padRatio = 0.15;

    const keyHeightBase = layoutParams.widthStyle.absolute ? rowHeight : ParsedLengthStyle.forScalar(1);
    const padTop = keyHeightBase.scaledBy(padRatio / 2);
    const keyHeight = keyHeightBase.scaledBy(1 - padRatio);

    // Update all key-square layouts.
    const keyStyleUpdates = this.keys.map((key) => {
      return () => {
        const keySquare  = key.btn.parentElement;
        const keyElement = key.btn;

        // Set the kmw-key-square position
        const kss = keySquare.style;
        kss.height=kss.minHeight=keyHeightBase.styleString;

        const kes = keyElement.style;
        kes.top = padTop.styleString;
        kes.height=kes.lineHeight=kes.minHeight=keyHeight.styleString;
      }
    })

    return () => {
      executeRowStyleUpdates();
      keyStyleUpdates.forEach((closure) => closure());
    }
  }

  public refreshKeyLayouts(layoutParams: LayerLayoutParams) {
    const updateClosures = this.keys.map((key) => {
      // Calculate changes to be made...
      const keyElement = key.btn;

      const widthStyle = layoutParams.widthStyle;
      const heightStyle = layoutParams.heightStyle;

      const keyWidth = widthStyle.scaledBy(key.spec.proportionalWidth);
      const keyPad =   widthStyle.scaledBy(key.spec.proportionalPad);

      const keyHeight = heightStyle.scaledBy(this.heightFraction);

      // Match the row height (if fixed-height) or use full row height (if percent-based)
      const styleHeight = heightStyle.absolute ? keyHeight.styleString : '100%';

      const keyStyle: KeyLayoutParams = {
        keyWidth:  keyWidth.val  * (keyWidth.absolute ? 1 : layoutParams.keyboardWidth),
        keyHeight: keyHeight.val * (heightStyle.absolute ? 1 : layoutParams.keyboardHeight),
        baseEmFontSize: layoutParams.baseEmFontSize,
        layoutFontSize: layoutParams.layoutFontSize
      };
      //return keyElement.key ? keyElement.key.refreshLayout(keyStyle) : () => {};
      const keyFontClosure = keyElement.key ? keyElement.key.refreshLayout(keyStyle) : () => {};

      // And queue them to be run in a single batch later.  This helps us avoid layout reflow thrashing.
      return () => {
        key.square.style.width = keyWidth.styleString;
        key.square.style.marginLeft = keyPad.styleString;

        key.btn.style.width = widthStyle.absolute ? keyWidth.styleString : '100%';
        key.square.style.height = styleHeight;
        keyFontClosure();
      }
    });

    return () => updateClosures.forEach((closure) => closure());
  }
}