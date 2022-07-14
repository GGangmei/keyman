#include "pch.h"
#include "compfile.h"      //_S2 #include <compfile.h>
#include "comperr.h"    // _S2 #include <comperr.h>
#include "kmcmpdll.h">"   // _S2 #include <kmcmpdll.h>

KMX_BOOL CheckKeyboardFinalVersion(PFILE_KEYBOARD fk) {
  char16_t buf[128];

  if (fk->dwFlags & KF_AUTOMATICVERSION) {
    if (fk->version <= 0) {
      fk->version = VERSION_60; // minimum version that we can be safe with
    }

// _S2 TODO
//    u16printf(buf, "The compiler has assigned a minimum engine version of %d.%d based on features used in this keyboard", (int)((fk->version & 0xFF00) >> 8), (int)(fk->version & 0xFF));
//    AddCompileString(buf);
  }

  return TRUE;
}

KMX_BOOL VerifyKeyboardVersion(PFILE_KEYBOARD fk, KMX_DWORD ver) {
  if (fk->dwFlags & KF_AUTOMATICVERSION) {
    fk->version = max(fk->version, ver);
    return TRUE;
  }

  return fk->version >= ver;
}
