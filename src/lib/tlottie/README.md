# tlottie

Lottie renderer used for `.tgs` stickers and animated emoji, running inside media workers.

`tlottie.wasm` is a prebuilt binary vendored from [dkaraush/tlottie](https://github.com/dkaraush/tlottie)
(MIT License), commit [`c461cd5`](https://github.com/dkaraush/tlottie/commit/c461cd5c295b1abb9b4e8cd62bd875d9b4d676e3)
and built with its size-optimized Cargo profile.

To rebuild from source (requires Rust with the `wasm32-unknown-unknown` target):

```sh
rustup target add wasm32-unknown-unknown
RUSTFLAGS="-C target-feature=+simd128" cargo build \
  --target wasm32-unknown-unknown \
  --profile release-size \
  --no-default-features \
  --features wasm \
  --lib \
  --locked
# Output: target/wasm32-unknown-unknown/release-size/tlottie.wasm
```

Note: the binary requires WASM SIMD support (baseline feature, no runtime dispatch).
