import * as r from 'restructure';

/* Definitions from kmx_file.h. Must be kept in sync */

// In memory representations of KMX structures
// kmx-builder will transform these to the corresponding COMP_xxxx

export class KEYBOARD {
  isKMXPlus: boolean;
  //TODO: additional header fields
  groups: GROUP[];
  stores: STORE[];
};

export class STORE {
  dwSystemID: number;
  dpName: string;
  dpString: string;
};

export class GROUP {
  dpName: string;
  keys: KEY[];
  dpMatch: string;
  dpNoMatch: string;
  fUsingKeys: boolean;
};

export class KEY {
  Key: number;
  Line: number;
  ShiftFlags: number;
  dpOutput: string;
  dpContext: string;
};


export default class KMXFile {

  /* KMX file structures */

  public readonly COMP_STORE: any;
  public readonly COMP_KEY: any;
  public readonly COMP_GROUP: any;
  public readonly COMP_KEYBOARD_KMXPLUSINFO: any;
  public readonly COMP_KEYBOARD: any;

  public static readonly FILEID_COMPILED	= 0x5354584B; // 'KXTS'

  //
  // File version identifiers (COMP_KEYBOARD.dwFileVersion)
  //

  public static readonly VERSION_30 =  0x00000300;
  public static readonly VERSION_31 =  0x00000301;
  public static readonly VERSION_32 =  0x00000302;
  public static readonly VERSION_40 =  0x00000400;
  public static readonly VERSION_50 =  0x00000500;
  public static readonly VERSION_501 = 0x00000501;
  public static readonly VERSION_60 =  0x00000600;
  public static readonly VERSION_70 =  0x00000700;
  public static readonly VERSION_80 =  0x00000800;
  public static readonly VERSION_90 =  0x00000900;
  public static readonly VERSION_100 = 0x00000A00;
  public static readonly VERSION_140 = 0x00000E00;
  public static readonly VERSION_150 = 0x00000F00;

  public static readonly VERSION_160 = 0x00001000;

  public static readonly VERSION_MIN = this.VERSION_50;
  public static readonly VERSION_MAX = this.VERSION_160;

  //
  // Backspace types
  //

  public static readonly BK_DEFAULT =    0;
  public static readonly BK_DEADKEY =    1;

  // Different begin types (COMP_STORE.StartGroup_*)

  public static readonly BEGIN_ANSI =    0;
  public static readonly BEGIN_UNICODE = 1;

  //
  // System Store values (COMP_STORE.dwSystemID)
  //

  public static readonly TSS_NONE =                0;
  public static readonly TSS_BITMAP =              1;
  public static readonly TSS_COPYRIGHT =           2;
  public static readonly TSS_HOTKEY =              3;
  public static readonly TSS_LANGUAGE =            4;
  public static readonly TSS_LAYOUT =              5;
  public static readonly TSS_MESSAGE =             6;
  public static readonly TSS_NAME =                7;
  public static readonly TSS_VERSION =             8;
  public static readonly TSS_CAPSONONLY =          9;
  public static readonly TSS_CAPSALWAYSOFF =       10;
  public static readonly TSS_SHIFTFREESCAPS =      11;
  public static readonly TSS_LANGUAGENAME =        12;

  public static readonly TSS_CALLDEFINITION =      13;
  public static readonly TSS_CALLDEFINITION_LOADFAILED = 14;

  public static readonly TSS_ETHNOLOGUECODE =      15;

  public static readonly TSS_DEBUG_LINE =          16;

  public static readonly TSS_MNEMONIC =            17;

  public static readonly TSS_INCLUDECODES =        18;

  public static readonly TSS_OLDCHARPOSMATCHING =  19;

  public static readonly TSS_COMPILEDVERSION =     20;
  public static readonly TSS_KEYMANCOPYRIGHT =     21;

  public static readonly TSS_CUSTOMKEYMANEDITION =     22;
  public static readonly TSS_CUSTOMKEYMANEDITIONNAME = 23;

  /* Keyman 7.0 system stores */

  public static readonly TSS__KEYMAN_60_MAX =   23;

  public static readonly TSS_VISUALKEYBOARD =   24;
  public static readonly TSS_KMW_RTL =          25;
  public static readonly TSS_KMW_HELPFILE =     26;
  public static readonly TSS_KMW_HELPTEXT =     27;
  public static readonly TSS_KMW_EMBEDJS =      28;

  public static readonly TSS_WINDOWSLANGUAGES = 29;

  public static readonly TSS__KEYMAN_70_MAX =   29;

  /* Keyman 8.0 system stores */

  public static readonly TSS_COMPARISON =       30;

  public static readonly TSS__KEYMAN_80_MAX =   30;

  /* Keyman 9.0 system stores */

  public static readonly TSS_PLATFORM =    31;
  public static readonly TSS_BASELAYOUT =  32;
  public static readonly TSS_LAYER =       33;

  public static readonly TSS_PLATFORM_NOMATCH =  0x8001;  // Reserved for internal use - after platform statement is run, set to either TSS_PLATFORM_NOMATCH or TSS_PLATFORM_MATCH
  public static readonly TSS_PLATFORM_MATCH =    0x8002;  // Reserved for internal use - as the result will never change for the lifetime of the process.

  public static readonly TSS_VKDICTIONARY =     34;      // Dictionary of virtual key names for v9 dynamic layouts
  public static readonly TSS_LAYOUTFILE =       35;      // Keyman 9 layer-based JSON OSK
  public static readonly TSS_KEYBOARDVERSION =  36;      // &keyboardversion system store   // I4140
  public static readonly TSS_KMW_EMBEDCSS =     37;

  public static readonly TSS_TARGETS =          38;

  public static readonly TSS__KEYMAN_90_MAX =   38;

  /* Keyman 14.0 system stores */

  public static readonly TSS_CASEDKEYS =        39;

  public static readonly TSS__KEYMAN_140_MAX =  39;

  /* Keyman 15.0 system stores */

  public static readonly TSS_BEGIN_NEWCONTEXT =    40;
  public static readonly TSS_BEGIN_POSTKEYSTROKE = 41;
  public static readonly TSS_NEWLAYER =            42;
  public static readonly TSS_OLDLAYER =            43;

  public static readonly TSS__KEYMAN_150_MAX =     43;

  public static readonly TSS__MAX =                43;


  public static readonly UC_SENTINEL =       0xFFFF;
  public static readonly UC_SENTINEL_EXTENDEDEND = 0x10;

  public static readonly U_UC_SENTINEL = "\uFFFF";

  //
  // VK__MAX defines the highest virtual key code defined in the system = 0xFF.  Custom VK codes start at 256
  //

  public static readonly VK__MAX = 255;

  //
  // Extended String CODE_ values
  //

  public static readonly CODE_ANY =          0x01;
  public static readonly CODE_INDEX =        0x02;
  public static readonly CODE_CONTEXT =      0x03;
  public static readonly CODE_NUL =          0x04;
  public static readonly CODE_USE =          0x05;
  public static readonly CODE_RETURN =       0x06;
  public static readonly CODE_BEEP =         0x07;
  public static readonly CODE_DEADKEY =      0x08;
  //  0x09 = bkspace.-- we don't need to keep this separate though with UC_SENTINEL
  public static readonly CODE_EXTENDED =     0x0A;
  //public static readonly CODE_EXTENDEDEND =  0x0B;  deprecated
  public static readonly CODE_SWITCH =       0x0C;
  public static readonly CODE_KEY =          0x0D;
  public static readonly CODE_CLEARCONTEXT = 0x0E;
  public static readonly CODE_CALL =         0x0F;
  // UC_SENTINEL_EXTENDEDEND  0x10
  public static readonly CODE_CONTEXTEX =    0x11;

  public static readonly CODE_NOTANY =   0x12;

  public static readonly CODE_KEYMAN70_LASTCODE =    0x12;

  public static readonly CODE_SETOPT =    0x13;
  public static readonly CODE_IFOPT =     0x14;
  public static readonly CODE_SAVEOPT =   0x15;
  public static readonly CODE_RESETOPT =  0x16;

  public static readonly CODE_KEYMAN80_LASTCODE =  0x16;

  /* Keyman 9.0 codes */

  public static readonly CODE_IFSYSTEMSTORE =  0x17;
  public static readonly CODE_SETSYSTEMSTORE = 0x18;

  public static readonly CODE_LASTCODE =   0x18;


  public static readonly KF_SHIFTFREESCAPS =   0x0001;
  public static readonly KF_CAPSONONLY =       0x0002;
  public static readonly KF_CAPSALWAYSOFF =    0x0004;
  public static readonly KF_LOGICALLAYOUT =    0x0008;
  public static readonly KF_AUTOMATICVERSION = 0x0010;

  // 16.0: Support for LDML Keyboards in KMXPlus file format
  public static readonly KF_KMXPLUS =  0x0020;

  public static readonly HK_ALT =      0x00010000;
  public static readonly HK_CTRL =     0x00020000;
  public static readonly HK_SHIFT =    0x00040000;

  public static readonly LCTRLFLAG =   0x0001;    // Left Control flag
  public static readonly RCTRLFLAG =   0x0002;    // Right Control flag
  public static readonly LALTFLAG =    0x0004;    // Left Alt flag
  public static readonly RALTFLAG =    0x0008;    // Right Alt flag
  public static readonly K_SHIFTFLAG = 0x0010;    // Either shift flag
  public static readonly K_CTRLFLAG =  0x0020;    // Either ctrl flag
  public static readonly K_ALTFLAG =   0x0040;    // Either alt flag
  //public static readonly K_METAFLAG =  0x0080;    // Either Meta-key flag (tentative).  Not usable in keyboard rules;
                                  // Used internally (currently, only by KMW) to ensure Meta-key
                                  // shortcuts safely bypass rules
                                  // Meta key = Command key on macOS, Windows key on Windows
  public static readonly CAPITALFLAG    = 0x0100;    // Caps lock on
  public static readonly NOTCAPITALFLAG = 0x0200;    // Caps lock NOT on
  public static readonly NUMLOCKFLAG    = 0x0400;    // Num lock on
  public static readonly NOTNUMLOCKFLAG = 0x0800;    // Num lock NOT on
  public static readonly SCROLLFLAG     = 0x1000;    // Scroll lock on
  public static readonly NOTSCROLLFLAG  = 0x2000;    // Scroll lock NOT on
  public static readonly ISVIRTUALKEY   = 0x4000;    // It is a Virtual Key Sequence
  public static readonly VIRTUALCHARKEY = 0x8000;    // Keyman 6.0: Virtual Key Cap Sequence NOT YET

  public static readonly K_MODIFIERFLAG    = 0x007F;
  public static readonly K_NOTMODIFIERFLAG = 0xFF00;   // I4548

  public static readonly KEYBOARDFILEHEADER_SIZE = 64;
  public static readonly KEYBOARDFILESTORE_SIZE  = 12;
  public static readonly KEYBOARDFILEGROUP_SIZE  = 24;
  public static readonly KEYBOARDFILEKEY_SIZE    = 20;

  /* In-memory representation of the keyboard */

  public keyboard: KEYBOARD = {
    isKMXPlus: false,
    groups: [],
    stores: []
  };

  constructor() {

    // Binary-correct structures matching kmx_file.h

    this.COMP_STORE = new r.Struct({
      dwSystemID: r.uint32,
      dpName: r.uint32,
      dpString: r.uint32
    });

    if(this.COMP_STORE.size() != KMXFile.KEYBOARDFILESTORE_SIZE) {
      throw "COMP_STORE size is "+this.COMP_STORE.size()+" but should be "+KMXFile.KEYBOARDFILESTORE_SIZE+" bytes";
    }

    this.COMP_KEY = new r.Struct({
      Key: r.uint16le,
      _padding: new r.Reserved(r.uint16le), // padding
      Line: r.uint32le,
      ShiftFlags: r.uint32le,
      dpOutput: r.uint32le,
      dpContext: r.uint32le
    });

    if(this.COMP_KEY.size() != KMXFile.KEYBOARDFILEKEY_SIZE) {
      throw "COMP_KEY size is "+this.COMP_KEY.size()+" but should be "+KMXFile.KEYBOARDFILEKEY_SIZE+" bytes";
    }

    this.COMP_GROUP = new r.Struct({
      dpName: r.uint32le,
      dpKeyArray: r.uint32le,   // [LPKEY] address of first item in key array
      dpMatch: r.uint32le,
      dpNoMatch: r.uint32le,
      cxKeyArray: r.uint32le,   // in array entries
      fUsingKeys: r.uint32le   // group(xx) [using keys] <-- specified or not
    });

    if(this.COMP_GROUP.size() != KMXFile.KEYBOARDFILEGROUP_SIZE) {
      throw "COMP_GROUP size is "+this.COMP_GROUP.size()+" but should be "+KMXFile.KEYBOARDFILEGROUP_SIZE+" bytes";
    }

    this.COMP_KEYBOARD_KMXPLUSINFO = new r.Struct({
      dpKMXPlus: r.uint32le,      // 0040 offset of KMXPlus data, <sect> header is first
      dwKMXPlusSize: r.uint32le  // 0044 size in bytes of entire KMXPlus data
    });

    this.COMP_KEYBOARD = new r.Struct({
      dwIdentifier: r.uint32le,   // 0000 Keyman compiled keyboard id

      dwFileVersion: r.uint32le,  // 0004 Version of the file - Keyman 4.0 is 0x0400

      dwCheckSum: r.uint32le,     // 0008 As stored in keyboard
      KeyboardID: r.uint32le,     // 000C as stored in HKEY_LOCAL_MACHINE//system//currentcontrolset//control//keyboard layouts
      IsRegistered: r.uint32le,   // 0010
      version: r.uint32le,        // 0014 keyboard version

      cxStoreArray: r.uint32le,   // 0018 in array entries
      cxGroupArray: r.uint32le,   // 001C in array entries

      dpStoreArray: r.uint32le,   // 0020 [LPSTORE] address of first item in store array
      dpGroupArray: r.uint32le,   // 0024 [LPGROUP] address of first item in group array

      StartGroup_ANSI: r.uint32le,     // 0028 index of starting ANSI group
      StartGroup_Unicode: r.uint32le,  // 0028 index of starting Unicode groups

      dwFlags: r.uint32le,        // 0030 Flags for the keyboard file

      dwHotKey: r.uint32le,       // 0034 standard windows hotkey (hiword=shift/ctrl/alt stuff, loword=vkey)

      dpBitmapOffset: r.uint32le, // 0038 offset of the bitmaps in the file
      dwBitmapSize: r.uint32le   // 003C size in bytes of the bitmaps
    });

    if(this.COMP_KEYBOARD.size() != KMXFile.KEYBOARDFILEHEADER_SIZE) {
      throw "COMP_KEYBOARD size is "+this.COMP_KEYBOARD.size()+" but should be "+KMXFile.KEYBOARDFILEHEADER_SIZE+" bytes";
    }
  }
}