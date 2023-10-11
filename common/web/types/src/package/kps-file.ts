//
// The interfaces in this file are designed with reference to the
// mapped structures produced by xml2js when passed a .kps file.
//
// A few notes:
//
// * Casing is updated to camelCase during load (leaving `iD` as a
//   mixed up beastie).
// * Arrays are buried a layer too deep (e.g. <Files><File/><File/></Files>
//   leads to KpsFiles.KpsFile[]
// * Properties such as used in Info Items use `_` and `$` and must be
//   extracted.
// * Strings element is not yet checked to be correct
//

export interface KpsPackage {
  /**
   * <Package> -- the root element.
   */
  package: KpsFile;
}

export interface KpsFile {
  system: KpsFileSystem;
  options: KpsFileOptions;
  info?: KpsFileInfo;
  files?: KpsFileContentFiles;
  keyboards?: KpsFileKeyboards;
  lexicalModels?: KpsFileLexicalModels;
  startMenu?: KpsFileStartMenu;
  strings?: KpsFileStrings;
  relatedPackages?: KpsFileRelatedPackages;
}

export interface KpsFileSystem {
  keymanDeveloperVersion: string;
  fileVersion: string;
}

export interface KpsFileOptions {
  followKeyboardVersion?: string;
  readMeFile?: string;
  graphicFile?: string;
  licenseFile?: string;
  welcomeFile?: string;
  executeProgram?: string;
  msiFileName?: string;
  msiOptions?: string;
}

export interface KpsFileInfo {
  name?: KpsFileInfoItem;
  copyright?: KpsFileInfoItem;
  author?: KpsFileInfoItem;
  webSite?: KpsFileInfoItem;
  version?: KpsFileInfoItem;
  description?: KpsFileInfoItem;
}

export interface KpsFileInfoItem {
  _: string;
  $: { URL: string };
}

export interface KpsFileContentFiles {
  file: KpsFileContentFile[] | KpsFileContentFile;
}

export interface KpsFileContentFile {
  name: string;
  /** @deprecated */
  description: string;
  /** @deprecated */
  copyLocation: string;
  /** @deprecated */
  fileType: string;
}

export interface KpsFileLexicalModel {
  name: string;
  iD: string;
  languages: KpsFileLanguages;
}

export interface KpsFileLexicalModels {
  lexicalModel: KpsFileLexicalModel[] | KpsFileLexicalModel;
}

export interface KpsFileLanguages {
  language: KpsFileLanguage[] | KpsFileLanguage;
}

export interface KpsFileLanguage {
  _: string;
  $: { ID: string }
}

export interface KpsFileRelatedPackages {
  relatedPackage: KpsFileRelatedPackage | KpsFileRelatedPackage[];
}

export interface KpsFileRelatedPackage {
  $: {
    ID: string;
    /**
     * relationship between this package and the related package, "related" is default if not specified
     */
    Relationship?: "deprecates";
  }
}

export interface KpsFileKeyboard {
  name: string;     /// the descriptive name of the keyboard
  iD: string;       /// the keyboard identifier, equal to the basename of the keyboard file sans extension
  version: string;
  oSKFont?: string;
  displayFont?: string;
  rTL?: string;
  languages?: KpsFileLanguages;
  examples?: KpsFileLanguageExamples;
  /**
   * array of web font alternatives for OSK. should be same font data as oskFont
   */
  webOSKFonts?: KpsFileFonts;
  /**
   * array of web font alternatives for display. should be same font data as displayFont
   */
  webDisplayFonts?: KpsFileFonts;
}

export interface KpsFileFonts {
  font: KpsFileFont[] | KpsFileFont;
}

export interface KpsFileFont {
  $: {
    Filename: string;
  }
}

export interface KpsFileKeyboards {
  keyboard: KpsFileKeyboard[] | KpsFileKeyboard;
}

export interface KpsFileStartMenu {
  folder?: string;
  addUninstallEntry?: string;
  items?: KpsFileStartMenuItems;
}

export interface KpsFileStartMenuItem {
  name: string;
  fileName: string;
  arguments?: string;
  icon?: string;
  location?: string;
}

export interface KpsFileStartMenuItems {
  item: KpsFileStartMenuItem[] | KpsFileStartMenuItem;
}

export interface KpsFileStrings {
  string: KpsFileString[] | KpsFileString;
}

export interface KpsFileString {
  $: {
    name: string;
    value: string;
  }
}

export interface KpsFileLanguageExamples {
  example: KpsFileLanguageExample | KpsFileLanguageExample[];
}

/**
 * An example key sequence intended to demonstrate how the keyboard works
 */
export interface KpsFileLanguageExample {
  $: {
    /**
     * BCP 47 identifier for the example
     */
    ID: string;
    /**
     * A space-separated list of keys.
     * - modifiers indicated with "+"
     * - spacebar is "space"
     * - plus key is "shift+=" or "plus" on US English (all other punctuation as per key cap).
     * - Hardware modifiers are: "shift", "ctrl", "alt", "left-ctrl",
     *   "right-ctrl", "left-alt", "right-alt"
     * - Key caps should generally be their character for desktop (Latin script
     *   case insensitive), or the actual key cap for touch
     * - Caps Lock should be indicated with "caps-on", "caps-off"
     *
     * e.g. "shift+a b right-alt+c space plus z z z" represents something like: "Ab{AltGr+C} +zzz"
     */
    Keys: string;
    /**
     * The text that would be generated by typing those keys
     */
    Text?: string;
    /**
     * A short description of what the text means or represents
     */
    Note?: string;
  }
}
