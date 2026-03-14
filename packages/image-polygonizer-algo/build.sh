#!/usr/bin/env bash
set -e

PROFILE=${1:-release}

if [ "$PROFILE" = "dev" ]; then
    wasm-pack build --dev --target no-modules --out-dir dist --out-name image-poligonizer
else
    wasm-pack build --target no-modules --out-dir dist --out-name image-poligonizer
fi

mv dist/image-poligonizer_bg.wasm dist/image-polygonizer.wasm
find dist -maxdepth 1 -type f -not -name 'image-polygonizer.wasm' -delete
