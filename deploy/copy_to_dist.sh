#!/usr/bin/env bash

cp -R ./public/* ${1:-"dist"}

cp ./src/lib/rlottie/rlottie-wasm.wasm ${1:-"dist"}
cp ./src/lib/video-preview/libav-3.10.5.1.2-webcodecs.wasm.js ${1:-"dist"}
cp ./src/lib/video-preview/libav-3.10.5.1.2-webcodecs.wasm.wasm ${1:-"dist"}
cp ./src/lib/webp/webp_wasm.wasm ${1:-"dist"}

cp ./node_modules/opus-recorder/dist/decoderWorker.min.wasm ${1:-"dist"}

cp -R ./node_modules/emoji-data-ios/img-apple-64 ${1:-"dist"}
cp -R ./node_modules/emoji-data-ios/img-apple-160 ${1:-"dist"}
