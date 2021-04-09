/* eslint-disable */
importScripts('webp_wasm.js');

Module.onRuntimeInitialized = async () => {
  self.postMessage({ type: 'initialized' });
};

self.onmessage = (event) => {
  const { id, blob } = event.data;
  const reader = new FileReader();

  reader.addEventListener('loadend', () => {
    const buffer = reader.result;

    const size = buffer.byteLength;
    const thisPtr = Module._malloc(size);
    Module.HEAPU8.set(new Uint8Array(buffer), thisPtr);

    const getInfo = Module.cwrap('getInfo', 'number', ['number', 'number']);

    const ptr = getInfo(thisPtr, size);
    const success = !!Module.getValue(ptr, 'i32');
    if (!success) {
      Module._free(ptr);
      Module._free(thisPtr);
      self.postMessage({
        type: 'result', id, width: 0, height: 0, result: null,
      });
      return;
    }
    const width = Module.getValue(ptr + 4, 'i32');
    const height = Module.getValue(ptr + 8, 'i32');

    Module._free(ptr);

    const decode = Module.cwrap('decode', 'number', ['number', 'number']);

    const resultPtr = decode(thisPtr, size);

    const resultView = new Uint8Array(Module.HEAPU8.buffer, resultPtr, width * height * 4);
    const result = new Uint8ClampedArray(resultView);
    Module._free(resultPtr);
    Module._free(thisPtr);

    self.postMessage({
      type: 'result', id, width, height, result,
    });
  });

  reader.readAsArrayBuffer(blob);
};
