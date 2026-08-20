# tlottie

Lottie renderer used for `.tgs` stickers and animated emoji, running inside media workers.

`tlottie.wasm` is a prebuilt binary vendored from [dkaraush/tlottie](https://github.com/dkaraush/tlottie)
(MIT License), commit [`685f17e`](https://github.com/dkaraush/tlottie/commit/685f17e348c613d4d62896f49fc01f6ec4e8f028)
and built with its `release-nostd` Cargo profile.

To rebuild from source (requires Rust with the `wasm32-unknown-unknown` target):

```sh
rustup target add wasm32-unknown-unknown
RUSTFLAGS="-C target-feature=+simd128" cargo build --profile release-nostd \
  --target wasm32-unknown-unknown \
  --no-default-features \
  --features wasm,no-std \
  --lib \
  --locked
# Output: target/wasm32-unknown-unknown/release-nostd/tlottie.wasm
```

Note: the binary requires WASM SIMD support (baseline feature, no runtime dispatch).
