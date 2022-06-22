program buildpkg;

{$APPTYPE CONSOLE}

uses
  SysUtils,
  buildpkgmain in 'buildpkgmain.pas',
  CompilePackageInstaller in '..\..\..\..\developer\src\common\delphi\compiler\CompilePackageInstaller.pas',
  utilsystem in '..\..\..\..\common\windows\delphi\general\utilsystem.pas',
  CompilePackage in '..\..\..\..\developer\src\common\delphi\compiler\CompilePackage.pas',
  kmpinffile in '..\..\..\..\common\windows\delphi\packages\kmpinffile.pas',
  kpsfile in '..\..\..\..\developer\src\common\delphi\packages\kpsfile.pas',
  PackageInfo in '..\..\..\..\common\windows\delphi\packages\PackageInfo.pas',
  utildir in '..\..\..\..\common\windows\delphi\general\utildir.pas',
  utilstr in '..\..\..\..\common\windows\delphi\general\utilstr.pas',
  utilfiletypes in '..\..\..\..\common\windows\delphi\general\utilfiletypes.pas',
  Unicode in '..\..\..\..\common\windows\delphi\general\Unicode.pas',
  VersionInfo in '..\..\..\..\common\windows\delphi\general\VersionInfo.pas',
  PackageFileFormats in '..\..\..\..\common\windows\delphi\packages\PackageFileFormats.pas',
  GetOsVersion in '..\..\..\..\common\windows\delphi\general\GetOsVersion.pas',
  RegistryKeys in '..\..\..\..\common\windows\delphi\general\RegistryKeys.pas',
  KeymanDeveloperOptions in '..\..\..\..\developer\src\tike\main\KeymanDeveloperOptions.pas',
  RedistFiles in '..\..\..\..\developer\src\tike\main\RedistFiles.pas',
  DebugPaths in '..\..\..\..\common\windows\delphi\general\DebugPaths.pas',
  CustomisationStorage in '..\..\global\delphi\cust\CustomisationStorage.pas',
  StockFileNames in '..\..\global\delphi\cust\StockFileNames.pas',
  klog in '..\..\..\..\common\windows\delphi\general\klog.pas',
  httpuploader in '..\..\..\..\common\windows\delphi\general\httpuploader.pas',
  Upload_Settings in '..\..\..\..\common\windows\delphi\general\Upload_Settings.pas',
  UfrmTike in '..\..\..\..\developer\src\tike\main\UfrmTike.pas' {TikeForm: TTntForm},
  utilhttp in '..\..\..\..\common\windows\delphi\general\utilhttp.pas',
  kmxfile in '..\..\..\..\common\windows\delphi\keyboards\kmxfile.pas',
  utilkeyboard in '..\..\..\..\common\windows\delphi\keyboards\utilkeyboard.pas',
  CRC32 in '..\..\..\..\common\windows\delphi\general\CRC32.pas',
  KeyNames in '..\..\..\..\common\windows\delphi\general\KeyNames.pas',
  wininet5 in '..\..\..\..\common\windows\delphi\general\wininet5.pas',
  GlobalProxySettings in '..\..\..\..\common\windows\delphi\general\GlobalProxySettings.pas',
  ErrorControlledRegistry in '..\..\..\..\common\windows\delphi\vcl\ErrorControlledRegistry.pas',
  utilexecute in '..\..\..\..\common\windows\delphi\general\utilexecute.pas',
  KeymanVersion in '..\..\..\..\common\windows\delphi\general\KeymanVersion.pas',
  Glossary in '..\..\..\..\common\windows\delphi\general\Glossary.pas',
  Keyman.Developer.System.Project.ProjectLog in '..\..\..\..\developer\src\tike\project\Keyman.Developer.System.Project.ProjectLog.pas',
  UserMessages in '..\..\..\..\common\windows\delphi\general\UserMessages.pas',
  VisualKeyboard in '..\..\..\..\common\windows\delphi\visualkeyboard\VisualKeyboard.pas',
  VisualKeyboardLoaderBinary in '..\..\..\..\common\windows\delphi\visualkeyboard\VisualKeyboardLoaderBinary.pas',
  VisualKeyboardLoaderXML in '..\..\..\..\common\windows\delphi\visualkeyboard\VisualKeyboardLoaderXML.pas',
  VisualKeyboardSaverBinary in '..\..\..\..\common\windows\delphi\visualkeyboard\VisualKeyboardSaverBinary.pas',
  VisualKeyboardSaverXML in '..\..\..\..\common\windows\delphi\visualkeyboard\VisualKeyboardSaverXML.pas',
  TempFileManager in '..\..\..\..\common\windows\delphi\general\TempFileManager.pas',
  ExtShiftState in '..\..\..\..\common\windows\delphi\visualkeyboard\ExtShiftState.pas',
  VKeyChars in '..\..\..\..\common\windows\delphi\general\VKeyChars.pas',
  VKeys in '..\..\..\..\common\windows\delphi\general\VKeys.pas',
  JsonUtil in '..\..\..\..\common\windows\delphi\general\JsonUtil.pas',
  Keyman.System.PackageInfoRefreshKeyboards in '..\..\..\..\developer\src\common\delphi\packages\Keyman.System.PackageInfoRefreshKeyboards.pas',
  Keyman.System.KMXFileLanguages in '..\..\..\..\developer\src\common\delphi\keyboards\Keyman.System.KMXFileLanguages.pas',
  Keyman.System.Standards.ISO6393ToBCP47Registry in '..\..\..\..\common\windows\delphi\standards\Keyman.System.Standards.ISO6393ToBCP47Registry.pas',
  Keyman.System.Standards.LCIDToBCP47Registry in '..\..\..\..\common\windows\delphi\standards\Keyman.System.Standards.LCIDToBCP47Registry.pas',
  Keyman.System.KeyboardJSInfo in '..\..\..\..\developer\src\common\delphi\keyboards\Keyman.System.KeyboardJSInfo.pas',
  Keyman.System.KeyboardUtils in '..\..\..\..\developer\src\common\delphi\keyboards\Keyman.System.KeyboardUtils.pas',
  Keyman.System.LanguageCodeUtils in '..\..\..\..\common\windows\delphi\general\Keyman.System.LanguageCodeUtils.pas',
  Keyman.System.RegExGroupHelperRSP19902 in '..\..\..\..\common\windows\delphi\vcl\Keyman.System.RegExGroupHelperRSP19902.pas',
  kmxfileconsts in '..\..\..\..\common\windows\delphi\keyboards\kmxfileconsts.pas',
  BCP47Tag in '..\..\..\..\common\windows\delphi\general\BCP47Tag.pas',
  Keyman.System.Standards.BCP47SubtagRegistry in '..\..\..\..\common\windows\delphi\standards\Keyman.System.Standards.BCP47SubtagRegistry.pas',
  Keyman.System.Standards.BCP47SuppressScriptRegistry in '..\..\..\..\common\windows\delphi\standards\Keyman.System.Standards.BCP47SuppressScriptRegistry.pas',
  Keyman.System.CanonicalLanguageCodeUtils in '..\..\..\..\common\windows\delphi\general\Keyman.System.CanonicalLanguageCodeUtils.pas',
  Keyman.System.LexicalModelUtils in '..\..\..\..\developer\src\common\delphi\lexicalmodels\Keyman.System.LexicalModelUtils.pas',
  Keyman.System.PackageInfoRefreshLexicalModels in '..\..\..\..\developer\src\common\delphi\packages\Keyman.System.PackageInfoRefreshLexicalModels.pas',
  Keyman.System.Standards.LangTagsRegistry in '..\..\..\..\common\windows\delphi\standards\Keyman.System.Standards.LangTagsRegistry.pas',
  KeymanPaths in '..\..\..\..\common\windows\delphi\general\KeymanPaths.pas',
  Keyman.Developer.System.KeymanDeveloperPaths in '..\..\..\..\developer\src\tike\main\Keyman.Developer.System.KeymanDeveloperPaths.pas';

begin
  Run;
end.
