import { CompilerErrorNamespace, CompilerErrorSeverity, CompilerEvent, CompilerMessageSpec as m, compilerExceptionToString as exc } from "@keymanapp/common-types";

const Namespace = CompilerErrorNamespace.KmnCompiler;
const SevInfo = CompilerErrorSeverity.Info | Namespace;
const SevHint = CompilerErrorSeverity.Hint | Namespace;
const SevWarn = CompilerErrorSeverity.Warn | Namespace;
const SevError = CompilerErrorSeverity.Error | Namespace;
const SevFatal = CompilerErrorSeverity.Fatal | Namespace;

/**
 * LogLevel comes from kmn_compiler_errors.h, for legacy compiler error messages
 */
const enum LogLevel {
  LEVEL_MASK = 0xF000,
  CODE_MASK = 0x0FFF,
  CERR_FATAL = 0x8000,
  CERR_ERROR = 0x4000,
  CERR_WARNING = 0x2000,
  CERR_HINT = 0x1000,
  CERR_INFO = 0
};

/**
 * Translate the legacy compiler error messages to Severity codes
 */
const LogLevelToSeverity: Record<number,number> = {
  [LogLevel.CERR_FATAL]:   SevFatal,
  [LogLevel.CERR_ERROR]:   SevError,
  [LogLevel.CERR_WARNING]: SevWarn,
  [LogLevel.CERR_HINT]:    SevHint,
  [LogLevel.CERR_INFO]:    SevInfo
}

export const enum KmnCompilerMessageRanges {
  RANGE_KMN_COMPILER_MIN    = 0x001, // from kmn_compiler_errors.h
  RANGE_KMN_COMPILER_MAX    = 0x7FF, // from kmn_compiler_errors.h
  RANGE_LEXICAL_MODEL_MIN   = 0x800, // from kmn_compiler_errors.h, deprecated -- this range will not be used in future versions
  RANGE_LEXICAL_MODEL_MAX   = 0x8FF, // from kmn_compiler_errors.h, deprecated -- this range will not be used in future versions
  RANGE_CompilerMessage_Min = 0x900, // All compiler messages listed here must be >= this value
  RANGE_CompilerMessage_Max = 0xFFF, // Highest available error code for kmc-kmn
}

/*
  The messages in this class share the namespace with messages from
  kmn_compiler_errors.h, which are generated by kmcmplib, so values below 0x1000
  are reserved for kmcmplib messages.
*/
export class CompilerMessages {
  static Fatal_UnexpectedException = (o:{e: any}) => m(this.FATAL_UnexpectedException, `Unexpected exception: ${exc(o.e)}`);
  static FATAL_UnexpectedException = SevFatal | 0x900;

  static Fatal_MissingWasmModule = (o:{e?: any}) => m(this.FATAL_MissingWasmModule, `Could not instantiate WASM compiler module or initialization failed: ${exc(o.e)}`);
  static FATAL_MissingWasmModule = SevFatal | 0x901;

  // TODO: Is this now deprecated?
  static Fatal_UnableToSetCompilerOptions = () => m(this.FATAL_UnableToSetCompilerOptions, `Unable to set compiler options`);
  static FATAL_UnableToSetCompilerOptions = SevFatal | 0x902;

  static Fatal_CallbacksNotSet = () => m(this.FATAL_CallbacksNotSet, `Callbacks were not set with init`);
  static FATAL_CallbacksNotSet = SevFatal | 0x903;

  static Fatal_UnicodeSetOutOfRange = () => m(this.FATAL_UnicodeSetOutOfRange, `UnicodeSet buffer was too small`);
  static FATAL_UnicodeSetOutOfRange = SevFatal | 0x904;

  static Error_UnicodeSetHasStrings = () => m(this.ERROR_UnicodeSetHasStrings, `UnicodeSet contains strings, not allowed`);
  static ERROR_UnicodeSetHasStrings = SevError | 0x905;

  static Error_UnicodeSetHasProperties = () => m(this.ERROR_UnicodeSetHasProperties, `UnicodeSet contains properties, not allowed`);
  static ERROR_UnicodeSetHasProperties = SevError | 0x906;

  static Error_UnicodeSetSyntaxError = () => m(this.ERROR_UnicodeSetSyntaxError, `UnicodeSet had a Syntax Error while parsing`);
  static ERROR_UnicodeSetSyntaxError = SevError | 0x907;

  static Error_InvalidKvksFile = (o:{filename: string, e: any}) => m(this.ERROR_InvalidKvksFile,
    `Error encountered parsing ${o.filename}: ${o.e}`);
  static ERROR_InvalidKvksFile = SevError | 0x908;

  static Warn_InvalidVkeyInKvksFile = (o:{filename: string, invalidVkey: string}) => m(this.WARN_InvalidVkeyInKvksFile,
    `Invalid virtual key ${o.invalidVkey} found in ${o.filename}`);
  static WARN_InvalidVkeyInKvksFile = SevWarn | 0x909;

  static Error_InvalidDisplayMapFile = (o:{filename: string, e: any}) => m(this.ERROR_InvalidDisplayMapFile,
    `Error encountered parsing display map ${o.filename}: ${o.e}`);
  static ERROR_InvalidDisplayMapFile = SevError | 0x90A;
};

/**
 * This class defines messages from kmcmplib. They should correspond to codes in
 * kmn_compiler_errors.h, exclusive severity bits. For example:
 *
 * ```
 *   kmcmplib.CERR_BadCallParams = CERR_FATAL | 0x002 = 0x8002
 *   ERROR_BadCallParams = SevError | 0x0002 = 0x300000 | 0x2000 | 0x002 = 0x302002
 * ```
 *
 * CERR_ messages that are actually fatals have been renamed to FATAL_.
 *
 * Message text is defined by kmcmplib and passed through a callback.
 */
export class KmnCompilerMessages {
  static INFO_None                                            = SevInfo | 0x000;
  static INFO_EndOfFile                                       = SevInfo | 0x001;

  static FATAL_BadCallParams                                  = SevFatal | 0x002;
  static FATAL_CannotAllocateMemory                           = SevFatal | 0x004;
  static FATAL_InfileNotExist                                 = SevFatal | 0x005;
  static FATAL_CannotCreateOutfile                            = SevFatal | 0x006;
  static FATAL_UnableToWriteFully                             = SevFatal | 0x007;
  static FATAL_CannotReadInfile                               = SevFatal | 0x008;
  static FATAL_SomewhereIGotItWrong                           = SevFatal | 0x009;

  static ERROR_InvalidToken                                   = SevError | 0x00A;
  static ERROR_InvalidBegin                                   = SevError | 0x00B;
  static ERROR_InvalidName                                    = SevError | 0x00C;
  static ERROR_InvalidVersion                                 = SevError | 0x00D;
  static ERROR_InvalidLanguageLine                            = SevError | 0x00E;
  static ERROR_LayoutButNoLanguage                            = SevError | 0x00F;
  static ERROR_InvalidLayoutLine                              = SevError | 0x010;
  static ERROR_NoVersionLine                                  = SevError | 0x011;
  static ERROR_InvalidGroupLine                               = SevError | 0x012;
  static ERROR_InvalidStoreLine                               = SevError | 0x013;
  static ERROR_InvalidCodeInKeyPartOfRule                     = SevError | 0x014;
  static ERROR_InvalidDeadkey                                 = SevError | 0x015;
  static ERROR_InvalidValue                                   = SevError | 0x016;
  static ERROR_ZeroLengthString                               = SevError | 0x017;
  static ERROR_TooManyIndexToKeyRefs                          = SevError | 0x018;
  static ERROR_UnterminatedString                             = SevError | 0x019;
  static ERROR_StringInVirtualKeySection                      = SevError | 0x01A;
  static ERROR_AnyInVirtualKeySection                         = SevError | 0x01B;
  static ERROR_InvalidAny                                     = SevError | 0x01C;
  static ERROR_StoreDoesNotExist                              = SevError | 0x01D;
  static ERROR_BeepInVirtualKeySection                        = SevError | 0x01E;
  static ERROR_IndexInVirtualKeySection                       = SevError | 0x01F;
  static ERROR_InvalidIndex                                   = SevError | 0x020;
  static ERROR_OutsInVirtualKeySection                        = SevError | 0x021;
  static ERROR_InvalidOuts                                    = SevError | 0x022;
  static ERROR_ContextInVirtualKeySection                     = SevError | 0x024;
  static ERROR_InvalidUse                                     = SevError | 0x025;
  static ERROR_GroupDoesNotExist                              = SevError | 0x026;
  static ERROR_VirtualKeyNotAllowedHere                       = SevError | 0x027;
  static ERROR_InvalidSwitch                                  = SevError | 0x028;
  static ERROR_NoTokensFound                                  = SevError | 0x029;
  static ERROR_InvalidLineContinuation                        = SevError | 0x02A;
  static ERROR_LineTooLong                                    = SevError | 0x02B;
  static ERROR_InvalidCopyright                               = SevError | 0x02C;
  static ERROR_CodeInvalidInThisSection                       = SevError | 0x02D;
  static ERROR_InvalidMessage                                 = SevError | 0x02E;
  static ERROR_InvalidLanguageName                            = SevError | 0x02F;
  static ERROR_InvalidBitmapLine                              = SevError | 0x030;
  static ERROR_CannotReadBitmapFile                           = SevError | 0x031;
  static ERROR_IndexDoesNotPointToAny                         = SevError | 0x032;
  static ERROR_ReservedCharacter                              = SevError | 0x033;
  static ERROR_InvalidCharacter                               = SevError | 0x034;
  static ERROR_InvalidCall                                    = SevError | 0x035;
  static ERROR_CallInVirtualKeySection                        = SevError | 0x036;
  static ERROR_CodeInvalidInKeyStore                          = SevError | 0x037;
  static ERROR_CannotLoadIncludeFile                          = SevError | 0x038;

  static ERROR_60FeatureOnly_EthnologueCode                   = SevError | 0x039;
  static ERROR_60FeatureOnly_MnemonicLayout                   = SevError | 0x03A;
  static ERROR_60FeatureOnly_OldCharPosMatching               = SevError | 0x03B;
  static ERROR_60FeatureOnly_NamedCodes                       = SevError | 0x03C;
  static ERROR_60FeatureOnly_Contextn                         = SevError | 0x03D;
  static ERROR_501FeatureOnly_Call                            = SevError | 0x03E;

  static ERROR_InvalidNamedCode                               = SevError | 0x03F;
  static ERROR_InvalidSystemStore                             = SevError | 0x040;

  static ERROR_60FeatureOnly_VirtualCharKey                   = SevError | 0x044;

  static ERROR_VersionAlreadyIncluded                         = SevError | 0x045;

  static ERROR_70FeatureOnly                                  = SevError | 0x046;

  static ERROR_80FeatureOnly                                  = SevError | 0x047;
  static ERROR_InvalidInVirtualKeySection                     = SevError | 0x048;
  static ERROR_InvalidIf                                      = SevError | 0x049;
  static ERROR_InvalidReset                                   = SevError | 0x04A;
  static ERROR_InvalidSet                                     = SevError | 0x04B;
  static ERROR_InvalidSave                                    = SevError | 0x04C;

  static ERROR_InvalidEthnologueCode                          = SevError | 0x04D;

  static FATAL_CannotCreateTempfile                           = SevFatal | 0x04E;

  static ERROR_90FeatureOnly_IfSystemStores                   = SevError | 0x04F;
  static ERROR_IfSystemStore_NotFound                         = SevError | 0x050;
  static ERROR_90FeatureOnly_SetSystemStores                  = SevError | 0x051;
  static ERROR_SetSystemStore_NotFound                        = SevError | 0x052;
  static ERROR_90FeatureOnlyVirtualKeyDictionary              = SevError | 0x053;

  static ERROR_NotSupportedInKeymanWebContext                 = SevError | 0x054;
  static ERROR_NotSupportedInKeymanWebOutput                  = SevError | 0x055;
  static ERROR_NotSupportedInKeymanWebStore                   = SevError | 0x056;
  static ERROR_VirtualCharacterKeysNotSupportedInKeymanWeb    = SevError | 0x057;
  static ERROR_VirtualKeysNotValidForMnemonicLayouts          = SevError | 0x058;
  static ERROR_InvalidTouchLayoutFile                         = SevError | 0x059;
  static ERROR_TouchLayoutInvalidIdentifier                   = SevError | 0x05A;
  static ERROR_InvalidKeyCode                                 = SevError | 0x05B;
  static ERROR_90FeatureOnlyLayoutFile                        = SevError | 0x05C;
  static ERROR_90FeatureOnlyKeyboardVersion                   = SevError | 0x05D;
  static ERROR_KeyboardVersionFormatInvalid                   = SevError | 0x05E;
  static ERROR_ContextExHasInvalidOffset                      = SevError | 0x05F;
  static ERROR_90FeatureOnlyEmbedCSS                          = SevError | 0x060;
  static ERROR_90FeatureOnlyTargets                           = SevError | 0x061;
  static ERROR_ContextAndIndexInvalidInMatchNomatch           = SevError | 0x062;
  static ERROR_140FeatureOnlyContextAndNotAnyWeb              = SevError | 0x063;

  static ERROR_ExpansionMustFollowCharacterOrVKey             = SevError | 0x064;
  static ERROR_VKeyExpansionMustBeFollowedByVKey              = SevError | 0x065;
  static ERROR_CharacterExpansionMustBeFollowedByCharacter    = SevError | 0x066;
  static ERROR_VKeyExpansionMustUseConsistentShift            = SevError | 0x067;
  static ERROR_ExpansionMustBePositive                        = SevError | 0x068;

  static ERROR_CasedKeysMustContainOnlyVirtualKeys            = SevError | 0x069;
  static ERROR_CasedKeysMustNotIncludeShiftStates             = SevError | 0x06A;
  static ERROR_CasedKeysNotSupportedWithMnemonicLayout        = SevError | 0x06B;

  static ERROR_CannotUseReadWriteGroupFromReadonlyGroup       = SevError | 0x06C;
  static ERROR_StatementNotPermittedInReadonlyGroup           = SevError | 0x06D;
  static ERROR_OutputInReadonlyGroup                          = SevError | 0x06E;
  static ERROR_NewContextGroupMustBeReadonly                  = SevError | 0x06F;
  static ERROR_PostKeystrokeGroupMustBeReadonly               = SevError | 0x070;

  static ERROR_DuplicateGroup                                 = SevError | 0x071;
  static ERROR_DuplicateStore                                 = SevError | 0x072;

  static ERROR_RepeatedBegin                                  = SevError | 0x073;

  static WARN_TooManyWarnings                                 = SevWarn | 0x080;
  static WARN_OldVersion                                      = SevWarn | 0x081;
  static WARN_BitmapNotUsed                                   = SevWarn | 0x082;
  static WARN_CustomLanguagesNotSupported                     = SevWarn | 0x083;
  static WARN_KeyBadLength                                    = SevWarn | 0x084;
  static WARN_IndexStoreShort                                 = SevWarn | 0x085;
  static WARN_UnicodeInANSIGroup                              = SevWarn | 0x086;
  static WARN_ANSIInUnicodeGroup                              = SevWarn | 0x087;
  static WARN_UnicodeSurrogateUsed                            = SevWarn | 0x088;
  static WARN_ReservedCharacter                               = SevWarn | 0x089;
  static WARN_Info                                            = SevWarn | 0x08A;
  static WARN_VirtualKeyWithMnemonicLayout                    = SevWarn | 0x08B;
  static WARN_VirtualCharKeyWithPositionalLayout              = SevWarn | 0x08C;
  static WARN_StoreAlreadyUsedAsOptionOrCall                  = SevWarn | 0x08D;
  static WARN_StoreAlreadyUsedAsStoreOrCall                   = SevWarn | 0x08E;
  static WARN_StoreAlreadyUsedAsStoreOrOption                 = SevWarn | 0x08F;

  static WARN_PunctuationInEthnologueCode                     = SevWarn | 0x090;

  static WARN_TouchLayoutMissingLayer                         = SevWarn | 0x091;
  static WARN_TouchLayoutCustomKeyNotDefined                  = SevWarn | 0x092;
  static WARN_TouchLayoutMissingRequiredKeys                  = SevWarn | 0x093;
  static WARN_HelpFileMissing                                 = SevWarn | 0x094;
  static WARN_EmbedJsFileMissing                              = SevWarn | 0x095;
  static WARN_TouchLayoutFileMissing                          = SevWarn | 0x096;
  static WARN_VisualKeyboardFileMissing                       = SevWarn | 0x097;
  static WARN_ExtendedShiftFlagsNotSupportedInKeymanWeb       = SevWarn | 0x098;
  static WARN_TouchLayoutUnidentifiedKey                      = SevWarn | 0x099;
  static HINT_UnreachableKeyCode                              = SevHint | 0x09A;

  static WARN_CouldNotCopyJsonFile                            = SevWarn | 0x09B;
  static WARN_PlatformNotInTargets                            = SevWarn | 0x09C;

  static WARN_HeaderStatementIsDeprecated                     = SevWarn | 0x09D;
  static WARN_UseNotLastStatementInRule                       = SevWarn | 0x09E;

  static WARN_TouchLayoutFontShouldBeSameForAllPlatforms      = SevWarn | 0x09F;
  static WARN_InvalidJSONMetadataFile                         = SevWarn | 0x0A0;
  static WARN_JSONMetadataOSKFontShouldMatchTouchFont         = SevWarn | 0x0A1;
  static WARN_KVKFileIsInSourceFormat                         = SevWarn | 0x0A2;

  static WARN_DontMixChiralAndNonChiralModifiers              = SevWarn | 0x0A3;
  static WARN_MixingLeftAndRightModifiers                     = SevWarn | 0x0A4;

  static WARN_LanguageHeadersDeprecatedInKeyman10             = SevWarn | 0x0A5;

  static HINT_NonUnicodeFile                                  = SevHint | 0x0A6;

  static WARN_TooManyErrorsOrWarnings                         = SevWarn | 0x0A7;

  static WARN_HotkeyHasInvalidModifier                        = SevWarn | 0x0A8;

  static WARN_TouchLayoutSpecialLabelOnNormalKey              = SevWarn | 0x0A9;

  static WARN_OptionStoreNameInvalid                          = SevWarn | 0x0AA;

  static WARN_NulNotFirstStatementInContext                   = SevWarn | 0x0AB;
  static WARN_IfShouldBeAtStartOfContext                      = SevWarn | 0x0AC;

  static WARN_KeyShouldIncludeNCaps                           = SevWarn | 0x0AD;

  static HINT_UnreachableRule                                 = SevHint | 0x0AE;

  static FATAL_BufferOverflow                                 = SevFatal | 0x0C0;
  static FATAL_Break                                          = SevFatal | 0x0C1;
};

export function mapErrorFromKmcmplib(line: number, code: number, msg: string): CompilerEvent {
  const severity = LogLevelToSeverity[code & LogLevel.LEVEL_MASK];
  const baseCode = code & LogLevel.CODE_MASK;
  const event: CompilerEvent = {
    line: line,
    code: severity | CompilerErrorNamespace.KmnCompiler | baseCode,
    message: msg
  };
  return event;
};
