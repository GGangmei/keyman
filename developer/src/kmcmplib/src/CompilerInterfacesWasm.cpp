#include "pch.h"
#include <kmcmplibapi.h>

#ifdef __EMSCRIPTEN__

/*
  WASM interface for compiler message callback
*/
EM_JS(int, wasm_msgproc, (int line, int msgcode, const char* text, char* context), {
  const proc = globalThis[UTF8ToString(context)].message;
  if(!proc || typeof proc != 'function') {
    console.log(`[${line}: ${msgcode}: ${UTF8ToString(text)}]`);
    return 0;
  } else {
    return proc(line, msgcode, UTF8ToString(text));
  }
});

EM_JS(int, wasm_loadfileproc, (const char* filename, const char* baseFilename, void* buffer, int bufferSize, char* context), {
  const proc = globalThis[UTF8ToString(context)].loadFile;
  if(!proc || typeof proc != 'function') {
    return 0;
  } else {
    if(buffer == 0) {
      return proc(UTF8ToString(filename), UTF8ToString(baseFilename), 0, 0);
    } else {
      return proc(UTF8ToString(filename), UTF8ToString(baseFilename), buffer, bufferSize);
    }
  }
});

bool wasm_LoadFileProc(const char* filename, const char* baseFilename, void* buffer, int* bufferSize, void* context) {
  char* msgProc = static_cast<char*>(context);
  if(buffer == nullptr) {
    *bufferSize = wasm_loadfileproc(filename, baseFilename, 0, 0, msgProc);
    return *bufferSize != -1;
  } else {
    return wasm_loadfileproc(filename, baseFilename, buffer, *bufferSize, msgProc) == 1;
  }
}

int wasm_CompilerMessageProc(int line, uint32_t dwMsgCode, const char* szText, void* context) {
  char* msgProc = static_cast<char*>(context);
  return wasm_msgproc(line, dwMsgCode, szText, msgProc);
}

struct WASM_COMPILER_INTERFACE {
  std::string callbacksKey;    // key of callbacks object on globalThis
};

struct WASM_COMPILER_RESULT {
  bool result;
  // Following are pointer offsets in heap + buffer size
  int kmx;
  int kmxSize;
  KMCMP_COMPILER_RESULT_EXTRA extra;
};

WASM_COMPILER_RESULT kmcmp_wasm_compile(std::string pszInfile, const KMCMP_COMPILER_OPTIONS options, const WASM_COMPILER_INTERFACE intf) {
  WASM_COMPILER_RESULT r = {false};
  KMCMP_COMPILER_RESULT kr;

  r.result = kmcmp_CompileKeyboard(
    pszInfile.c_str(),
    options,
    wasm_CompilerMessageProc,
    wasm_LoadFileProc,
    intf.callbacksKey.c_str(),
    kr
  );

  if(r.result) {
    // TODO: additional data as required by kmc_kmw
    r.kmx = (int) kr.kmx;
    r.kmxSize = (int) kr.kmxSize;
    r.extra = kr.extra;
  }

  return r;
}

namespace emscripten {
namespace internal {

template <typename T, typename Allocator>
struct BindingType<std::vector<T, Allocator>> {
    using ValBinding = BindingType<val>;
    using WireType = ValBinding::WireType;

    static WireType toWireType(const std::vector<T, Allocator> &vec) {
        return ValBinding::toWireType(val::array(vec));
    }

    static std::vector<T, Allocator> fromWireType(WireType value) {
        return vecFromJSArray<T>(ValBinding::fromWireType(value));
    }
};

template <typename T>
struct TypeID<T,
              typename std::enable_if_t<std::is_same<
                  typename Canonicalized<T>::type,
                  std::vector<typename Canonicalized<T>::type::value_type,
                              typename Canonicalized<T>::type::allocator_type>>::value>> {
    static constexpr TYPEID get() { return TypeID<val>::get(); }
};

}  // namespace internal
}  // namespace emscripten

EMSCRIPTEN_BINDINGS(compiler_interface) {

  emscripten::class_<KMCMP_COMPILER_OPTIONS>("CompilerOptions")
    .constructor<>()
    .property("saveDebug", &KMCMP_COMPILER_OPTIONS::saveDebug)
    .property("compilerWarningsAsErrors", &KMCMP_COMPILER_OPTIONS::compilerWarningsAsErrors)
    .property("warnDeprecatedCode", &KMCMP_COMPILER_OPTIONS::warnDeprecatedCode)
    .property("shouldAddCompilerVersion", &KMCMP_COMPILER_OPTIONS::shouldAddCompilerVersion)
    .property("target", &KMCMP_COMPILER_OPTIONS::target)
    ;

  emscripten::class_<WASM_COMPILER_INTERFACE>("CompilerInterface")
    .constructor<>()
    .property("callbacksKey", &WASM_COMPILER_INTERFACE::callbacksKey)
    ;

  emscripten::class_<WASM_COMPILER_RESULT>("CompilerResult")
    .constructor<>()
    .property("result", &WASM_COMPILER_RESULT::result)
    .property("kmx", &WASM_COMPILER_RESULT::kmx)
    .property("kmxSize", &WASM_COMPILER_RESULT::kmxSize)
    .property("extra", &WASM_COMPILER_RESULT::extra)
    ;

  emscripten::class_<KMCMP_COMPILER_RESULT_EXTRA>("CompilerResultExtra")
    .constructor<>()
    .property("targets", &KMCMP_COMPILER_RESULT_EXTRA::targets)
    .property("kmnFilename", &KMCMP_COMPILER_RESULT_EXTRA::kmnFilename)
    .property("kvksFilename", &KMCMP_COMPILER_RESULT_EXTRA::kvksFilename)
    .property("displayMapFilename", &KMCMP_COMPILER_RESULT_EXTRA::displayMapFilename)
    .property("stores", &KMCMP_COMPILER_RESULT_EXTRA::stores)
    ;

  emscripten::value_object<KMCMP_COMPILER_RESULT_EXTRA_STORE>("CompilerResultExtraStore")
    .field("storeType", &KMCMP_COMPILER_RESULT_EXTRA_STORE::storeType)
    .field("name", &KMCMP_COMPILER_RESULT_EXTRA_STORE::name)
    ;

  emscripten::function("kmcmp_compile", &kmcmp_wasm_compile);
  emscripten::function("kmcmp_parseUnicodeSet", &kmcmp_parseUnicodeSet);
}

#endif
