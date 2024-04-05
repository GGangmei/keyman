import { ActiveLayer, ActiveLayout } from '@keymanapp/keyboard-processor';

import OSKRow from './oskRow.js';
import OSKBaseKey from './oskBaseKey.js';
import VisualKeyboard from '../visualKeyboard.js';

export interface LayerLayoutParams {
  keyboardHeight: number;
  spacebarText: string;
}

export default class OSKLayer {
  public readonly element: HTMLDivElement;
  public readonly rows: OSKRow[];
  public readonly spec: ActiveLayer;
  public readonly nextlayer: string;

  public readonly globeKey:    OSKBaseKey;
  public readonly spaceBarKey: OSKBaseKey;
  public readonly hideKey:     OSKBaseKey;
  public readonly capsKey:     OSKBaseKey;
  public readonly numKey:      OSKBaseKey;
  public readonly scrollKey:   OSKBaseKey;

  private _rowHeight: number;

  public get rowHeight(): number {
    return this._rowHeight;
  }

  public get id(): string {
    return this.spec.id;
  }

  public constructor(vkbd: VisualKeyboard,
                      layout: ActiveLayout,
                      layer: ActiveLayer) {
    this.spec = layer;

    const gDiv = this.element = document.createElement('div');
    const gs=gDiv.style;
    gDiv.className='kmw-key-layer';

    var nRows=layer['row'].length;
    if(nRows > 4 && vkbd.device.formFactor == 'phone') {
      gDiv.className = gDiv.className + ' kmw-5rows';
    }

    // Set font for layer if defined in layout
    gs.fontFamily = 'font' in layout ? layout['font'] : '';

    this.nextlayer = gDiv['layer'] = layer['id'];
    if(typeof layer['nextlayer'] == 'string') {
      // The gDiv['nextLayer'] is no longer referenced in KMW 15.0+, but is
      // maintained for partial back-compat in case any site devs actually
      // relied on its value from prior versions.
      //
      // We won't pay attention to any mutations to the gDiv copy, though.
      gDiv['nextLayer'] = this.nextlayer = layer['nextlayer'];
    }

    // Create a DIV for each row of the group
    let rows=layer['row'];
    this.rows = [];

    for(let i=0; i<rows.length; i++) {
      let rowObj = new OSKRow(vkbd, layer, rows[i]);
      rowObj.displaysKeyCaps = layout["displayUnderlying"];
      gDiv.appendChild(rowObj.element);
      this.rows.push(rowObj);
    }

    // Identify and save references to the language key, hide keyboard key, and space bar
    if(vkbd.device.touchable) {
      this.globeKey  = this.findKey('K_LOPT');
      this.hideKey   = this.findKey('K_ROPT');
    }

    // Define for both desktop and touchable OSK
    this.spaceBarKey = this.findKey('K_SPACE');
    this.capsKey     = this.findKey('K_CAPS');
    this.numKey      = this.findKey('K_NUMLOCK');
    this.scrollKey   = this.findKey('K_SCROLL');

    if(this.spaceBarKey) {
      const spacebarLabel = this.spaceBarKey.label;
      let tParent = <HTMLElement>spacebarLabel.parentNode;

      if (typeof (tParent.className) == 'undefined' || tParent.className == '') {
        tParent.className = 'kmw-spacebar';
      } else if (tParent.className.indexOf('kmw-spacebar') == -1) {
        tParent.className += ' kmw-spacebar';
      }

      if (spacebarLabel.className != 'kmw-spacebar-caption') {
        spacebarLabel.className = 'kmw-spacebar-caption';
      }
    }
  }

  /**
   *  Find the OSKBaseKey representing the specified
   *  key ID for the currently visible OSK layer
   *
   *  @param    {string}  keyId   key identifier
   *  @return   {Object}          Reference to key
   */
  private findKey(keyId: string): OSKBaseKey {
    for(const row of this.rows) {
      for(const key of row.keys) {
        if(key.getBaseId() == keyId) {
          return key;
        }
      }
    }
    return null;
  }

  /**
   * Indicate the current language and keyboard on the space bar
   **/
  showLanguage(displayName: string) {
    if(!this.spaceBarKey) {
      return () => {};
    }

    try {
      const spacebarLabel = this.spaceBarKey.label;

      // The key can read the text from here during the display update without us
      // needing to trigger a reflow by running the closure below early.
      this.spaceBarKey.spec.text = displayName;

      // It sounds redundant, but this dramatically cuts down on browser DOM processing;
      // but sometimes innerText is reported empty when it actually isn't, so set it
      // anyway in that case (Safari, iOS 14.4)
      if (spacebarLabel.innerText != displayName || displayName == '') {
        spacebarLabel.innerText = displayName;
      }
    }
    catch (ex) { }
  }

  public refreshLayout(vkbd: VisualKeyboard, layoutParams: LayerLayoutParams) {
    const layerHeight = layoutParams.keyboardHeight;
    this.showLanguage(layoutParams.spacebarText);

    // Check the heights of each row, in case different layers have different row counts.
    const nRows = this.rows.length;
    const rowHeight = this._rowHeight = Math.floor(layerHeight/(nRows == 0 ? 1 : nRows));

    if(vkbd.usesFixedHeightScaling) {
      this.element.style.height=(layerHeight)+'px';
    }

    for(let nRow=0; nRow<nRows; nRow++) {
      const oskRow = this.rows[nRow];
      const bottom = (nRows-nRow-1)*rowHeight+1;

      if(vkbd.usesFixedHeightScaling) {
        // Calculate the exact vertical coordinate of the row's center.
        this.spec.row[nRow].proportionalY = ((layerHeight - bottom) - rowHeight/2) / layerHeight;

        if(nRow == nRows-1) {
          oskRow.element.style.bottom = '1px';
        }
      }

      oskRow.refreshLayout(vkbd);
    }
  }
}
