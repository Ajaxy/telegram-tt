#!/usr/bin/env bash

if [ ! -z ${CF_PAGES+x} ] && [ "$CF_PAGES" -eq "1" ]; then
    rm ./public/build-stats.json
    rm ./public/statoscope-report.html
fi

cp -R ./public/* ${1:-"dist"}

cp ./src/lib/rlottie/rlottie-wasm.wasm ${1:-"dist"}

cp ./node_modules/opus-recorder/dist/decoderWorker.min.wasm ${1:-"dist"}

cp -R ./node_modules/emoji-data-ios/img-apple-64 ${1:-"dist"}
cp -R ./node_modules/emoji-data-ios/img-apple-160 ${1:-"dist"}
