# tlottie

Lottie renderer used for `.tgs` stickers and animated emoji, running inside media workers.

`tlottie.wasm` and `tlottie-no-simd.wasm` are prebuilt binaries vendored from
[dkaraush/tlottie](https://github.com/dkaraush/tlottie) (MIT License), commit
[`3ce946c`](https://github.com/dkaraush/tlottie/commit/3ce946c9ede5ece8beead2edd9beab68718d990e),
and built with its `release-nostd` Cargo profile. The media worker downloads the baseline SIMD build when supported
and otherwise uses the no-SIMD fallback.

To rebuild from source, run these commands from the root of a tlottie checkout at the commit linked above. This
requires Rust with the `wasm32-unknown-unknown` target.

```sh
rustup target add wasm32-unknown-unknown

# Build the no-SIMD fallback.
RUSTFLAGS="" cargo build --profile release-nostd \
  --target wasm32-unknown-unknown \
  --no-default-features \
  --features wasm,no-std \
  --lib \
  --locked
cp target/wasm32-unknown-unknown/release-nostd/tlottie.wasm \
  /path/to/telegram-t/src/lib/tlottie/tlottie-no-simd.wasm

# Build the baseline SIMD version.
RUSTFLAGS="-C target-feature=+simd128" cargo build --profile release-nostd \
  --target wasm32-unknown-unknown \
  --no-default-features \
  --features wasm,no-std \
  --lib \
  --locked
cp target/wasm32-unknown-unknown/release-nostd/tlottie.wasm \
  /path/to/telegram-t/src/lib/tlottie/tlottie.wasm
```
