#!/bin/sh
# Builds the QuickJS wasm module the web worker and the Node harness run widget
# code in, from the TelegramMessenger/quickjs fork (quickjs-ng with fixes,
# including quickjs-ng#1400), with quickjs-emscripten 0.32.0's C interface and
# its quickjs-ng-wasmfile-release-sync flags, so @jitl's FFI and
# quickjs-emscripten-core work unchanged.
#
#   quickjs/build.sh [--docker] <fork checkout>           rebuild prebuilt/ and prebuilt.sha256
#   quickjs/build.sh --check [--docker] <fork checkout>   rebuild in a temporary directory and compare
#                                                         every file with prebuilt.sha256 (exit 1 on a difference)
#
# The fork is a checkout of TelegramMessenger/quickjs at the revision of
# prebuilt/QUICKJS_VERSION (NOTICE.md). The output in prebuilt/ is committed, so the web
# build needs no emcc; prebuilt.sha256 lists the sha256 of every prebuilt/ file. Only the
# browser build is made: the client ships no Node one (local patch, NOTICE.md).
#
# The build is reproducible: the same fork commit and the pinned emscripten
# (EMSDK_VERSION below) give the same bytes on any machine; checked on macOS
# arm64 with Homebrew's emscripten and in the emsdk image on Linux arm64.
# --docker runs the build in the emsdk image of that version, pinned by digest
# (EMSDK_IMAGE; needs only Docker); without --docker the emcc on PATH must
# report that version (`emsdk install 6.0.12 && emsdk activate 6.0.12`, or
# Homebrew's emscripten while it is at 6.0.12). A host C compiler and CMake
# build the fork's qjs, which writes the amalgamated source (Ninja when it is
# installed). What used to differ between two builds: the temporary directory
# in the amalgamation's __FILE__ (assert messages in the data segment), now
# mapped away with -ffile-prefix-map; the fork's version string is the first 7
# hex digits of its commit (not `git describe`, which a fetched tag changes).
# A new emscripten is a deliberate change: bump both pins, rebuild, commit
# prebuilt/ and prebuilt.sha256 together.
set -eu
EMSDK_VERSION=6.0.12
EMSDK_IMAGE=emscripten/emsdk:6.0.12@sha256:77638e6c215a65f25a704c0c831d5c2463a8c0468a58c6cb82489dbe621dfa05

HERE=$(cd "$(dirname "$0")" && pwd)
CHECK=0 DOCKER=0 FORK_ARG=
for arg in "$@"; do
  case $arg in
    --check) CHECK=1 ;;
    --docker) DOCKER=1 ;;
    -h|--help) sed -n '2,29p' "$0"; exit 0 ;;
    -*) echo "build.sh: unknown option $arg" >&2; exit 2 ;;
    *) FORK_ARG=$arg ;;
  esac
done
if [ -z "$FORK_ARG" ]; then
  echo "build.sh: give the TelegramMessenger/quickjs checkout to build from" >&2
  exit 2
fi
FORK=$(cd "$FORK_ARG" && pwd)

sha256() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$@"; else shasum -a 256 "$@"; fi; }
# `<sha256>  <file>` for every file of a directory, sorted by name (the format of prebuilt.sha256; `shasum -a 256 -c` reads it).
manifest() { (cd "$1" && for f in *; do [ -f "$f" ] && sha256 "$f"; done) | LC_ALL=C sort -k2; }

# The fork's version string: the first 7 hex digits of its commit. Inside the
# container git cannot follow the submodule's gitdir, so the host passes it in.
if [ -z "${QJS_VERSION:-}" ]; then
  QJS_VERSION=$(git -C "$FORK" rev-parse HEAD 2>/dev/null | cut -c1-7)
  [ -n "$QJS_VERSION" ] || QJS_VERSION=fork
  if [ -n "$(git -C "$FORK" status --porcelain --untracked-files=no 2>/dev/null)" ]; then
    echo "build.sh: warning: $FORK has local changes; the output will not match a clean checkout of $QJS_VERSION" >&2
  fi
fi

if [ "$DOCKER" = 1 ] && [ -z "${TW_IN_DOCKER:-}" ]; then
  FLAGS=
  [ "$CHECK" = 1 ] && FLAGS=--check
  exec docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -e TW_IN_DOCKER=1 -e QJS_VERSION="$QJS_VERSION" \
    -v "$HERE:/quickjs" -v "$FORK:/fork" -w /quickjs "$EMSDK_IMAGE" sh build.sh $FLAGS /fork
fi

EMCC_VERSION=$(emcc --version 2>/dev/null | sed -n '1s/.*) \([0-9][0-9.]*\).*/\1/p')
if [ "$EMCC_VERSION" != "$EMSDK_VERSION" ]; then
  echo "build.sh: emcc ${EMCC_VERSION:-not found}; the pinned toolchain is emscripten $EMSDK_VERSION (use --docker, or emsdk install $EMSDK_VERSION)" >&2
  exit 1
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
if [ "$CHECK" = 1 ]; then OUT="$WORK/out"; else OUT="$HERE/prebuilt"; fi
mkdir -p "$OUT"

GEN=
command -v ninja >/dev/null 2>&1 && GEN="-G Ninja"
cmake -S "$FORK" -B "$WORK/host" $GEN -DCMAKE_BUILD_TYPE=Release >/dev/null 2>&1
cmake --build "$WORK/host" --target qjs_exe >/dev/null 2>&1
# interface.c includes ../vendor/quickjs-ng/quickjs.h, as in quickjs-emscripten's tree.
NG="$WORK/vendor/quickjs-ng"
mkdir -p "$NG" "$WORK/c"
(cd "$FORK" && "$WORK/host/qjs" amalgam.js "$NG/quickjs-amalgam.c")
cp "$FORK/quickjs.h" "$FORK/quickjs-libc.h" "$NG/"
(cd "$NG" && patch -s -p1 --fuzz=3 < "$HERE/emscripten/0001-bellard-module-detection.patch")
cp "$HERE/emscripten/interface.c" "$WORK/c/"

# -ffile-prefix-map: __FILE__ is vendor/quickjs-ng/quickjs-amalgam.c, not the temporary directory.
CFLAGS="-Oz -flto -DQTS_USE_QUICKJS_NG -ffile-prefix-map=$WORK/="
LINK="-s MODULARIZE=1 -s IMPORTED_MEMORY=1 -s EXPORT_NAME=QuickJSRaw -s INVOKE_RUN=0 -s ALLOW_MEMORY_GROWTH=1 -s ALLOW_TABLE_GROWTH=1
  -s STACK_SIZE=5MB -s SUPPORT_ERRNO=0 -s IGNORE_MISSING_MAIN=0 --no-entry -s AUTO_JS_LIBRARIES=0 -lccall.js -s AUTO_NATIVE_LIBRARIES=0
  -s AUTO_ARCHIVE_INDEXES=0 -s DEFAULT_TO_CXX=0 -s ALLOW_UNIMPLEMENTED_SYSCALLS=0 -s MIN_NODE_VERSION=180300 -s NODEJS_CATCH_EXIT=0
  -s EXPORTED_RUNTIME_METHODS=@$HERE/emscripten/exportedRuntimeMethods.json -s EXPORTED_FUNCTIONS=@$HERE/emscripten/symbols.json
  --closure 1 -s FILESYSTEM=0 --pre-js $HERE/emscripten/pre-extension.js --pre-js $HERE/emscripten/pre-wasmMemory.js"

emcc $CFLAGS -D_GNU_SOURCE -DQJS_BUILD_LIBC -DCONFIG_VERSION="\"$QJS_VERSION\"" -c -o "$WORK/quickjs-amalgam.o" "$NG/quickjs-amalgam.c"
emcc $CFLAGS -Wno-cast-function-type -c -o "$WORK/interface.o" "$WORK/c/interface.c"
OBJS="$WORK/interface.o $WORK/quickjs-amalgam.o"
mkdir -p "$WORK/browser"
emcc $CFLAGS $LINK -s EXPORT_ES6=1 -s ENVIRONMENT=web,worker -o "$WORK/browser/emscripten-module.js" $OBJS
cp "$WORK/browser/emscripten-module.js" "$OUT/emscripten-module.browser.mjs"
cp "$WORK/browser/emscripten-module.wasm" "$OUT/emscripten-module.wasm"
echo "$QJS_VERSION" > "$OUT/QUICKJS_VERSION"

if [ "$CHECK" = 0 ]; then
  # The other prebuilt/ files (index, ffi, the .d.ts) are quickjs-emscripten 0.32.0's, committed as they are.
  manifest "$HERE/prebuilt" > "$HERE/prebuilt.sha256"
  echo "built from $FORK ($QJS_VERSION) with emscripten $EMCC_VERSION; prebuilt.sha256 updated"
  exit 0
fi

# --check: prebuilt/ is exactly what prebuilt.sha256 lists, and the rebuilt files have the listed hashes.
FAIL=0
if ! manifest "$HERE/prebuilt" | cmp -s - "$HERE/prebuilt.sha256"; then
  echo "build.sh --check: prebuilt/ differs from prebuilt.sha256:" >&2
  manifest "$HERE/prebuilt" | diff "$HERE/prebuilt.sha256" - >&2 || true
  FAIL=1
fi
for f in $(cd "$OUT" && ls); do
  want=$(awk -v f="$f" '$2 == f { print $1 }' "$HERE/prebuilt.sha256")
  got=$(sha256 "$OUT/$f" | cut -d' ' -f1)
  if [ "$want" != "$got" ]; then
    echo "build.sh --check: $f rebuilt as $got, prebuilt.sha256 lists ${want:-nothing}" >&2
    FAIL=1
  fi
done
if [ "$FAIL" = 0 ]; then
  echo "build.sh --check: prebuilt/ is reproducible from $FORK ($QJS_VERSION) with emscripten $EMCC_VERSION"
fi
exit "$FAIL"
