import * as xml2js from 'xml2js';
import KVKSourceFile from './kvks-file.js';
import CompilerCallbacks from '../compiler/callbacks.js';
import Ajv from 'ajv';
import { CompilerMessages } from '../compiler/messages.js';
import { boxXmlArray } from '../util/util.js';
import { VisualKeyboard, VisualKeyboardHeaderFlags, VisualKeyboardKey, VisualKeyboardKeyFlags, VisualKeyboardLegalShiftStates, VisualKeyboardShiftState } from './visual-keyboard.js';
import { USVirtualKeyCodes } from '../ldml-keyboard/virtual-key-constants.js';
import { BUILDER_KVK_HEADER_VERSION } from './kvk-file.js';

export default class KVKSFileReader {
  private readonly callbacks: CompilerCallbacks;

  constructor (callbacks: CompilerCallbacks) {
    this.callbacks = callbacks;
  }

  public read(file: Uint8Array): VisualKeyboard {
    let source = this.internalRead(file);
    return this.transform(source);
  }

  public internalRead(file: Uint8Array): KVKSourceFile {
    let source: KVKSourceFile;

    const parser = new xml2js.Parser({
      explicitArray: false,
      mergeAttrs: true,
      includeWhiteChars: true,
      normalize: false,
      emptyTag: {} as any
      // Why "as any"? xml2js is broken:
      // https://github.com/Leonidas-from-XIV/node-xml2js/issues/648 means
      // that an old version of `emptyTag` is used which doesn't support
      // functions, but DefinitelyTyped is requiring use of function or a
      // string. See also notes at
      // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/59259#issuecomment-1254405470
      // An alternative fix would be to pull xml2js directly from github
      // rather than using the version tagged on npmjs.com.
    });

    parser.parseString(file, (e: unknown, r: unknown) => { source = r as KVKSourceFile });
    source = this.boxArrays(source);
    this.cleanupUnderscore('visualkeyboard', source.visualkeyboard);
    return this.validate(source);
  }

  /**
   * The only element that allows spaces is <key>. Remove
   * all other empty whitespace-only values.
   * @param root
   * @param source
   */
  private cleanupUnderscore(root: string, source: any) {
    if(root != 'key') {
      if(source?.['_']?.trim() === '') {
        delete source['_'];
      }
    }

    for(let key of Object.keys(source)) {
      if(Array.isArray(source[key])) {
        for(let item of source[key]) {
          if(typeof(item) === 'object') {
            this.cleanupUnderscore(key, item);
          }
        }
      } else if(typeof source[key] === 'object') {
        this.cleanupUnderscore(key, source[key]);
      }
    }
  }

  public validate(source: KVKSourceFile): KVKSourceFile {
    const schema = JSON.parse(this.callbacks.loadKvksJsonSchema().toString('utf8'));
    const ajv = new Ajv();
    if(!ajv.validate(schema, source)) {
      console.dir(source, {depth:8});
      this.callbacks.reportMessage(CompilerMessages.Error_InvalidFile({errorText: ajv.errorsText()}));
      return null;
    }
    return source;
  }

  public transform(source: KVKSourceFile): VisualKeyboard {
    // NOTE: at this point, the xml should have been validated
    // and matched the schema result so we can assume properties exist
    let result: VisualKeyboard = {
      header: {
        version: BUILDER_KVK_HEADER_VERSION,
        flags: 0,
        ansiFont: { name: "Arial", size: -12, color: 0xFF000008 }, // TODO-LDML: consider defaults
        unicodeFont: { name: "Arial", size: -12, color: 0xFF000008 }, // TODO-LDML: consider defaults
        associatedKeyboard: source.visualkeyboard?.header?.kbdname
      },
      keys: []
    };

    if(source.visualkeyboard?.header?.flags?.displayunderlying !== undefined) {
      result.header.flags |= VisualKeyboardHeaderFlags.kvkhDisplayUnderlying;
    }
    if(source.visualkeyboard?.header?.flags?.key102 !== undefined) {
      result.header.flags |= VisualKeyboardHeaderFlags.kvkh102;
    }
    if(source.visualkeyboard?.header?.flags?.usealtgr !== undefined) {
      result.header.flags |= VisualKeyboardHeaderFlags.kvkhAltGr;
    }
    if(source.visualkeyboard?.header?.flags?.useunderlying !== undefined) {
      result.header.flags |= VisualKeyboardHeaderFlags.kvkhUseUnderlying;
    }

    for(let encoding of source.visualkeyboard.encoding) {
      let isUnicode = (encoding.name == 'unicode'),
        font = isUnicode ? result.header.unicodeFont : result.header.ansiFont;
      font.name = encoding.fontname;
      font.size = parseInt(encoding.fontsize,10);
      for(let layer of encoding.layer) {
        let shift = this.kvksShiftToKvkShift(layer.shift);
        for(let sourceKey of layer.key) {
          let vkey = (USVirtualKeyCodes as any)[sourceKey.vkey];
          if(!vkey) {
            this.callbacks.reportMessage(CompilerMessages.Error_VkeyIsNotValid({vkey: sourceKey.vkey}));
            continue;
          }
          let key: VisualKeyboardKey = {
            flags: isUnicode ? VisualKeyboardKeyFlags.kvkkUnicode : 0, // TODO-LDML: bitmap support
            shift: shift,
            text: sourceKey._ ?? '',
            vkey: vkey
          }
          result.keys.push(key);
        }
      }
    }

    return result;
  }

  /**
   * xml2js will not place single-entry objects into arrays.
   * Easiest way to fix this is to box them ourselves as needed
   * @param source KVKSourceFile
   */
  private boxArrays(source: KVKSourceFile) {
    boxXmlArray(source.visualkeyboard, 'encoding');
    for(let encoding of source.visualkeyboard.encoding) {
      boxXmlArray(encoding, 'layer');
      for(let layer of encoding.layer) {
        boxXmlArray(layer, 'key');
      }
    }
    return source;
  }


  public kvksShiftToKvkShift(shift: string): VisualKeyboardShiftState {
    shift = shift.toUpperCase();

    // TODO-LDML(lowpri): make a map of this?
    for(let state of VisualKeyboardLegalShiftStates) {
      if(state.name == shift) {
        return state.shift;
      }
    }
    return 0;
  }
}