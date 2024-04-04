import * as fs from 'fs';
import { assert } from 'chai';
import 'mocha';
import { TestCompilerCallbacks } from '@keymanapp/developer-test-helpers';
import { makePathToFixture } from './helpers/index.js';
import { KeyboardInfoCompiler, KeyboardInfoCompilerResult, unitTestEndpoints } from '../src/keyboard-info-compiler.js';
import langtags from "../src/imports/langtags.js";
import { KmpCompiler, KmpCompilerOptions } from '@keymanapp/kmc-package';
import { CompilerCallbacks, KMX, KeymanFileTypes, KeymanTargets, KmpJsonFile } from '@keymanapp/common-types';
import { KeyboardInfoFile, KeyboardInfoFileLanguage, KeyboardInfoFilePlatform } from './keyboard-info-file.js';

const callbacks = new TestCompilerCallbacks();

beforeEach(function() {
  callbacks.clear();
});

const KHMER_ANGKOR_KPJ = makePathToFixture('khmer_angkor', 'khmer_angkor.kpj');
const KHMER_ANGKOR_JS  = makePathToFixture('khmer_angkor', 'build', 'khmer_angkor.js');
const KHMER_ANGKOR_KPS = makePathToFixture('khmer_angkor', 'source', 'khmer_angkor.kps');
const KHMER_ANGKOR_KMP = makePathToFixture('khmer_angkor', 'build', 'khmer_angkor.kmp');

const KHMER_ANGKOR_SOURCES = {
  kmpFilename: KHMER_ANGKOR_KMP,
  sourcePath: 'release/k/khmer_angkor',
  kpsFilename: KHMER_ANGKOR_KPS,
  jsFilename: KHMER_ANGKOR_JS,
  forPublishing: true,
};

const KHMER_ANGKOR_DISPLAY_FONT = "Mondulkiri-R.ttf";
const KHMER_ANGKOR_OSK_FONT = "khmer_busra_kbd.ttf";
const KHMER_ANGKOR_EXAMPLES_NO_ID = { keys: "x j m E r", text: "ខ្មែរ", note: "Name of language" };

const KHMER_ANGKOR_KEYBOARD = {
  displayFont: KHMER_ANGKOR_DISPLAY_FONT,
  oskFont: KHMER_ANGKOR_OSK_FONT,
  name: "Khmer Angkor",
  id: "khmer_angkor",
  version: "1.3",
  languages: [ { name: "Central Khmer (Khmer, Cambodia)", id: "km" } ],
  examples: [ { id: "km", ...KHMER_ANGKOR_EXAMPLES_NO_ID } ]
};

const KHMER_ANGKOR_DISPLAY_FONT_INFO = { family: "Khmer Mondulkiri", source: [ KHMER_ANGKOR_DISPLAY_FONT ] };
const KHMER_ANGKOR_OSK_FONT_INFO = { family: "Khmer Busra Kbd", source: [ KHMER_ANGKOR_OSK_FONT ] };

const SECOND_DISPLAY_FONT = "second.ttf";
const SECOND_OSK_FONT = "second_osk.ttf";
const SECOND_EXAMPLES_NO_ID = { keys: "t w o", text: "two", note: "The number 2" };

const SECOND_KEYBOARD = {
  displayFont: SECOND_DISPLAY_FONT,
  oskFont: SECOND_OSK_FONT,
  name: "Second Lang",
  id: "second_lang",
  version: "0.1",
  languages: [ { name: "Second Language", id: "en" } ],
  examples: [ { id: "en", ...SECOND_EXAMPLES_NO_ID } ]
};

const SECOND_DISPLAY_FONT_INFO = { family: "Second", source: [ SECOND_DISPLAY_FONT ] };
const SECOND_OSK_FONT_INFO = { family: "Second Kbd", source: [ SECOND_OSK_FONT ] };

const JAVA_DISPLAY_FONT = "java.ttf";
const JAVA_OSK_FONT = "java_osk.ttf";
const JAVA_EXAMPLES_NO_ID = { keys: "j a v a", text: "java", note: "Java" };

const JAVA_KEYBOARD = {
  displayFont: JAVA_DISPLAY_FONT,
  oskFont: JAVA_OSK_FONT,
  name: "Java Lang",
  id: "Java_lang",
  version: "0.1",
  languages: [ { name: "Java Language", id: "jv-Arab-ID" } ],
  examples: [ { id: "jv-Arab-ID", ...JAVA_EXAMPLES_NO_ID } ]
};

const JAVA_DISPLAY_FONT_INFO = { family: "Java", source: [ JAVA_DISPLAY_FONT ] };
const JAVA_OSK_FONT_INFO = { family: "Java Kbd", source: [ JAVA_OSK_FONT ] };

describe('keyboard-info-compiler', function () {
  it('compile a .keyboard_info file correctly', async function() {
    const kpjFilename = KHMER_ANGKOR_KPJ;
    const buildKeyboardInfoFilename = makePathToFixture('khmer_angkor', 'build', 'khmer_angkor.keyboard_info');
    const sources = KHMER_ANGKOR_SOURCES;

    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    let result: KeyboardInfoCompilerResult = null;
    try {
      result = await compiler.run(kpjFilename, null);
    } catch(e) {
      callbacks.printMessages();
      throw e;
    }
    if(result == null) {
      callbacks.printMessages();
    }
    assert.isNotNull(result);

    const actual = JSON.parse(new TextDecoder().decode(result.artifacts.keyboard_info.data));
    const expected = JSON.parse(fs.readFileSync(buildKeyboardInfoFilename, 'utf-8'));

    // `lastModifiedDate` is dependent on time of run (not worth mocking)
    delete actual['lastModifiedDate'];
    delete expected['lastModifiedDate'];

    assert.deepEqual(actual, expected);
  });

  it('check preinit creates langtagsByTag correctly', async function() {
    const compiler = new KeyboardInfoCompiler(); // indirectly call preinit()
    assert.isNotNull(compiler);
    const en_langtag = langtags.find(({ tag }) => tag === 'en');
    assert.deepEqual((<any>unitTestEndpoints.langtagsByTag)['en'], en_langtag);
    assert.deepEqual((<any>unitTestEndpoints.langtagsByTag)['en-Latn-US'], en_langtag);
    assert.deepEqual((<any>unitTestEndpoints.langtagsByTag)['en-Latn'], en_langtag);
    assert.deepEqual((<any>unitTestEndpoints.langtagsByTag)['en-US'], en_langtag);
  });

  it('check init initialises KeyboardInfoCompiler correctly', async function() {
    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    assert.deepEqual(compiler['callbacks'], callbacks);
    assert.deepEqual(compiler['options'], {sources});
  });  

  it('check run returns null if KmpCompiler.init fails', async function() {
    const kpjFilename = KHMER_ANGKOR_KPJ;
    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    const origKmpCompilerInit = KmpCompiler.prototype.init;
    let result: KeyboardInfoCompilerResult;
    try {
      KmpCompiler.prototype.init = async (_callbacks: CompilerCallbacks, _options: KmpCompilerOptions): Promise<boolean> => false;
      result = await compiler.run(kpjFilename, null);
    } catch(e) {
      assert.fail(e);
    } finally {
      KmpCompiler.prototype.init = origKmpCompilerInit;
    }
    assert.isNull(result);
  });
  
  it('check run returns null if KmpCompiler.transformKpsToKmpObject fails', async function() {
    const kpjFilename = KHMER_ANGKOR_KPJ;
    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    const origKmpCompilerTransformKpsToKmpObject = KmpCompiler.prototype.transformKpsToKmpObject;
    let result: KeyboardInfoCompilerResult;
    try {
      KmpCompiler.prototype.transformKpsToKmpObject = (_kpsFilename: string): KmpJsonFile.KmpJsonFile => null;
      result = await compiler.run(kpjFilename, null);
    } catch(e) {
      assert.fail(e);
    } finally {
      KmpCompiler.prototype.transformKpsToKmpObject = origKmpCompilerTransformKpsToKmpObject;
    }
    assert.isNull(result);
  });
  
  it('check run returns null if loadJsFile fails', async function() {
    const kpjFilename = KHMER_ANGKOR_KPJ;
    const sources = KHMER_ANGKOR_SOURCES
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    compiler['loadJsFile'] = (_filename: string): string => null;
    const result = await compiler.run(kpjFilename, null);
    assert.isNull(result);
  }); 

  it('check run returns null if license is not MIT', async function() {
    const kpjFilename = KHMER_ANGKOR_KPJ;
    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    compiler['isLicenseMIT'] = (_filename: string): boolean => false;
    const result = await compiler.run(kpjFilename, null);
    assert.isNull(result);
  });

  it('check run returns null if fillLanguages fails', async function() {
    const kpjFilename = KHMER_ANGKOR_KPJ;
    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    compiler['fillLanguages'] = async (_kpsFilename: string, _keyboard_info: KeyboardInfoFile, _kmpJsonData:  KmpJsonFile.KmpJsonFile): Promise<boolean> => false;
    const result = await compiler.run(kpjFilename, null);
    assert.isNull(result);
  }); 

  it('should write artifacts to disk', async function() {
    const kpjFilename = KHMER_ANGKOR_KPJ;
    const actualFilename = makePathToFixture('khmer_angkor', 'build', 'actual.keyboard_info');
    const expectedFilename = makePathToFixture('khmer_angkor', 'build', 'khmer_angkor.keyboard_info');
    const sources = KHMER_ANGKOR_SOURCES;

    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    const result = await compiler.run(kpjFilename, null);
    assert.isNotNull(result);

    if(fs.existsSync(actualFilename)) {
      fs.rmSync(actualFilename);
    }

    result.artifacts.keyboard_info.filename = actualFilename;
    assert.isTrue(await compiler.write(result.artifacts));
    assert(fs.existsSync(actualFilename))

    const actual = JSON.parse(fs.readFileSync(actualFilename, 'utf-8'));
    const expected = JSON.parse(fs.readFileSync(expectedFilename, 'utf-8'));

    // `lastModifiedDate` is dependent on time of run (not worth mocking)
    delete actual['lastModifiedDate'];
    delete expected['lastModifiedDate'];

    assert.deepEqual(actual, expected);

    if(fs.existsSync(actualFilename)) { // tidy up
      fs.rmSync(actualFilename);
    }
  });

  it('check mapKeymanTargetToPlatform returns correct platforms', async function() {
    const compiler = new KeyboardInfoCompiler();
    const map: {[index in KeymanTargets.KeymanTarget]: KeyboardInfoFilePlatform[]} = {
      any: [], 
      androidphone: ['android'],
      androidtablet: ['android'],
      desktop: [], 
      ipad: ['ios'],
      iphone: ['ios'],
      linux: ['linux'],
      macosx: ['macos'],
      mobile: [], 
      tablet: [], 
      web: ['desktopWeb'],  
      windows: ['windows']
    }
    for (const [target, platform] of Object.entries(map)) {
      assert.deepEqual(compiler['mapKeymanTargetToPlatform'](<KeymanTargets.KeymanTarget>target), platform);
    }
  }); 

  it('check kmxFileVersionToString returns correct strings', async function() {
    const compiler = new KeyboardInfoCompiler();
    const convs = [
      {num: 0x0000, str: '0.0'},
      {num: 0x0001, str: '0.1'},
      {num: 0x0100, str: '1.0'},
      {num: 0x0101, str: '1.1'},
      {num: 0x0A0A, str: '10.10'},
    ];
    convs.forEach((conv) => {
      assert.equal(compiler['kmxFileVersionToString'](conv.num), conv.str);
    });
  });
  
  it('check loadKmxFiles returns empty array if .kmx file is missing from .kmp', async function() {
    const kpsFilename = KHMER_ANGKOR_KPS;
    const compiler = new KeyboardInfoCompiler();
    const kmpCompiler = new KmpCompiler();
    assert.isTrue(await kmpCompiler.init(callbacks, {}));
    const kmpJsonData = kmpCompiler.transformKpsToKmpObject(kpsFilename);
    assert.isNotNull(kmpJsonData);
    // remove .kmx file
    kmpJsonData.files = kmpJsonData.files.filter(file => !KeymanFileTypes.filenameIs(file.name, KeymanFileTypes.Binary.Keyboard));
    const kmxFiles: {
      filename: string,
      data: KMX.KEYBOARD
    }[] = compiler['loadKmxFiles'](kpsFilename, kmpJsonData);
    assert.deepEqual(kmxFiles, []);
  });

  it('check loadKmxFiles throws error if .kmx file is missing from disk', async function() {
    const kpsFilename = KHMER_ANGKOR_KPS;
    const compiler = new KeyboardInfoCompiler();
    const kmpCompiler = new KmpCompiler();
    assert.isTrue(await kmpCompiler.init(callbacks, {}));
    const kmpJsonData = kmpCompiler.transformKpsToKmpObject(kpsFilename);
    assert.isNotNull(kmpJsonData);
    // rename .kmx file in files list so it cannot be loaded from disk
    const kmpIndex = kmpJsonData.files.findIndex(file => KeymanFileTypes.filenameIs(file.name, KeymanFileTypes.Binary.Keyboard));
    kmpJsonData.files[kmpIndex].name = '../build/throw_error.kmx';
    assert.throws(() => compiler['loadKmxFiles'](kpsFilename, kmpJsonData));
  });  

  it('check loadKmxFiles can handle two .kmx files', async function() {
    const jsFilename = makePathToFixture('two-kmx', 'build', 'two_kmx.js');
    const kpsFilename = makePathToFixture('two-kmx', 'source', 'two_kmx.kps');
    const kmpFilename = makePathToFixture('two-kmx', 'build', 'two_kmx.kmp');

    const sources = {
      kmpFilename,
      sourcePath: 'release/k/two-kmx',
      kpsFilename,
      jsFilename: jsFilename,
      forPublishing: true,
    };

    const kmx_filename_001 = 'k_001___basic_input_unicodei.kmx';
    const kmx_filename_002 = 'k_002___basic_input_unicode.kmx';
    
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    const kmpJsonData: KmpJsonFile.KmpJsonFile = {
      system: { fileVersion: '', keymanDeveloperVersion: '' },
      options: null,
      files: [
        { name: '../build/' + kmx_filename_001, description: 'Keyboard 001' },
        { name: '../build/' + kmx_filename_002, description: 'Keyboard 002' },
      ]
    };
    const kmxFiles: {
      filename: string,
      data: KMX.KEYBOARD
    }[] = compiler['loadKmxFiles'](kpsFilename, kmpJsonData);
    assert.equal(kmxFiles.length, 2);
    assert.deepEqual(kmxFiles[0].filename, kmx_filename_001);
    assert.deepEqual(kmxFiles[1].filename, kmx_filename_002);
    assert.isNotNull(kmxFiles[0].data);
    assert.isNotNull(kmxFiles[1].data);
  });    

  it('check loadJsFile throws error if .js file is invalid', async function() {
    const jsFilename = makePathToFixture('invalid-js-file', 'build', 'invalid_js_file.js');
    const kpsFilename = makePathToFixture('invalid-js-file', 'source', 'invalid_js_file.kps');
    const kmpFilename = makePathToFixture('invalid-js-file', 'build', 'invalid_js_file.kmp');

    const sources = {
      kmpFilename,
      sourcePath: 'release/k/invalid-js-file',
      kpsFilename,
      jsFilename: jsFilename,
      forPublishing: true,
    };

    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    const origTextDecoderDecode = TextDecoder.prototype.decode;
    TextDecoder.prototype.decode = () => { throw new TypeError(); }
    assert.throws(() => compiler['loadJsFile'](jsFilename));
    TextDecoder.prototype.decode = origTextDecoderDecode;
  });

  it('check fillLanguages constructs keyboard_info.languages correctly', async function() {
    const kmpJsonData: KmpJsonFile.KmpJsonFile = {
      system: { fileVersion: '', keymanDeveloperVersion: '' },
      options: null,
      keyboards: [KHMER_ANGKOR_KEYBOARD],
    };

    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    compiler['fontSourceToKeyboardInfoFont'] = async (_kpsFilename: string, _kmpJsonData: KmpJsonFile.KmpJsonFile, _source: string[]) => {
      return (_source[0] == KHMER_ANGKOR_DISPLAY_FONT) ? KHMER_ANGKOR_DISPLAY_FONT_INFO : KHMER_ANGKOR_OSK_FONT_INFO;
    }
    const keyboard_info: KeyboardInfoFile = {};
    const result = await compiler['fillLanguages'](KHMER_ANGKOR_KPS, keyboard_info, kmpJsonData);
    assert.isTrue(result);
    assert.deepEqual(keyboard_info.languages, {km: {
      examples: [ KHMER_ANGKOR_EXAMPLES_NO_ID ],
      font: KHMER_ANGKOR_DISPLAY_FONT_INFO,
      oskFont: KHMER_ANGKOR_OSK_FONT_INFO,
      languageName: "Khmer",
      regionName: undefined,
      scriptName: undefined,
      displayName: "Khmer",
    }});
  });

  it('check fillLanguages can handle two keyboards correctly', async function() {
    const kmpJsonData: KmpJsonFile.KmpJsonFile = {
      system: { fileVersion: '', keymanDeveloperVersion: '' },
      options: null,
      keyboards: [KHMER_ANGKOR_KEYBOARD, SECOND_KEYBOARD],
    };

    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    let callCount = 0;
    compiler['fontSourceToKeyboardInfoFont'] = async (_kpsFilename: string, _kmpJsonData: KmpJsonFile.KmpJsonFile, _source: string[]) => {
      callCount++;
      const info = [KHMER_ANGKOR_DISPLAY_FONT_INFO, KHMER_ANGKOR_OSK_FONT_INFO, SECOND_DISPLAY_FONT_INFO, SECOND_OSK_FONT_INFO];
      return info[callCount-1];
    };
    const keyboard_info: KeyboardInfoFile = {};
    const result = await compiler['fillLanguages'](KHMER_ANGKOR_KPS, keyboard_info, kmpJsonData);
    assert.isTrue(result);
    assert.deepEqual(keyboard_info.languages, {km: {
      examples: [ KHMER_ANGKOR_EXAMPLES_NO_ID ],
      font: KHMER_ANGKOR_DISPLAY_FONT_INFO,
      oskFont: KHMER_ANGKOR_OSK_FONT_INFO,
      languageName: "Khmer",
      regionName: undefined,
      scriptName: undefined,
      displayName: "Khmer",
    }, en: {
      examples: [ SECOND_EXAMPLES_NO_ID ],
      font: SECOND_DISPLAY_FONT_INFO,
      oskFont: SECOND_OSK_FONT_INFO,
      languageName: "English",
      regionName: undefined,
      scriptName: undefined,
      displayName: "English",
    }});
  });

  it('check fillLanguages handles regions and scripts correctly', async function() {
    const kmpJsonData: KmpJsonFile.KmpJsonFile = {
      system: { fileVersion: '', keymanDeveloperVersion: '' },
      options: null,
      keyboards: [JAVA_KEYBOARD],
    };

    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    compiler['fontSourceToKeyboardInfoFont'] = async (_kpsFilename: string, _kmpJsonData: KmpJsonFile.KmpJsonFile, _source: string[]) => {
      return (_source[0] == JAVA_DISPLAY_FONT) ? JAVA_DISPLAY_FONT_INFO : JAVA_OSK_FONT_INFO;
    }
    const keyboard_info: KeyboardInfoFile = {};
    const result = await compiler['fillLanguages'](KHMER_ANGKOR_KPS, keyboard_info, kmpJsonData);
    assert.isTrue(result);
    assert.deepEqual(keyboard_info.languages, {'jv-Arab-ID': {
      examples: [ JAVA_EXAMPLES_NO_ID ],
      font: JAVA_DISPLAY_FONT_INFO,
      oskFont: JAVA_OSK_FONT_INFO,
      languageName: "Javanese",
      regionName: "Indonesia",
      scriptName: "Arabic",
      displayName: "Javanese (Arabic, Indonesia)",
    }});
  });

  it('check fillLanguages handles displayName correctly with no region', async function() {
    const keyboard = {...KHMER_ANGKOR_KEYBOARD, languages: [ { name: '', id: 'aaf-Arab' } ] };
    const kmpJsonData: KmpJsonFile.KmpJsonFile = {
      system: { fileVersion: '', keymanDeveloperVersion: '' },
      options: null,
      keyboards: [keyboard],
    };
    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    compiler['fontSourceToKeyboardInfoFont'] = async (_kpsFilename: string, _kmpJsonData: KmpJsonFile.KmpJsonFile, _source: string[]) => {
      return (_source[0] == KHMER_ANGKOR_DISPLAY_FONT) ? KHMER_ANGKOR_DISPLAY_FONT_INFO : KHMER_ANGKOR_OSK_FONT_INFO;
    }
    const keyboard_info: KeyboardInfoFile = {};
    const result = await compiler['fillLanguages'](KHMER_ANGKOR_KPS, keyboard_info, kmpJsonData);
    assert.isTrue(result);
    const displayName = (<{[bcp47: string]: KeyboardInfoFileLanguage}>keyboard_info.languages)['aaf-Arab'].displayName;
    assert.isTrue(displayName =="Aranadan (Arabic)");
  });

  it('check fillLanguages returns false if fontSourceToKeyboardInfoFont fails for display font', async function() {
    const kmpJsonData: KmpJsonFile.KmpJsonFile = {
      system: { fileVersion: '', keymanDeveloperVersion: '' },
      options: null,
      keyboards: [KHMER_ANGKOR_KEYBOARD],
    };

    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    compiler['fontSourceToKeyboardInfoFont'] = async (_kpsFilename: string, _kmpJsonData: KmpJsonFile.KmpJsonFile, _source: string[]) => {
      return (_source[0] == KHMER_ANGKOR_DISPLAY_FONT) ? null : KHMER_ANGKOR_OSK_FONT_INFO;
    }
    const result = await compiler['fillLanguages'](KHMER_ANGKOR_KPS, {}, kmpJsonData);
    assert.isFalse(result);
  });

  it('check fillLanguages returns false if fontSourceToKeyboardInfoFont fails for osk font', async function() {
    const kmpJsonData: KmpJsonFile.KmpJsonFile = {
      system: { fileVersion: '', keymanDeveloperVersion: '' },
      options: null,
      keyboards: [KHMER_ANGKOR_KEYBOARD],
    };

    const sources = KHMER_ANGKOR_SOURCES;
    const compiler = new KeyboardInfoCompiler();
    assert.isTrue(await compiler.init(callbacks, {sources}));
    compiler['fontSourceToKeyboardInfoFont'] = async (_kpsFilename: string, _kmpJsonData: KmpJsonFile.KmpJsonFile, _source: string[]) => {
      return (_source[0] == KHMER_ANGKOR_DISPLAY_FONT) ? KHMER_ANGKOR_DISPLAY_FONT_INFO : null;
    }
    const result = await compiler['fillLanguages'](KHMER_ANGKOR_KPS, {}, kmpJsonData);
    assert.isFalse(result);
  });
});
