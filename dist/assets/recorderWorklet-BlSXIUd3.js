const DEFAULT_BUFFER_SIZE = 2048;

class VoiceCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.bufferSize = opts.bufferSize || DEFAULT_BUFFER_SIZE;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;

    this.port.onmessage = (e) => {
      if (e.data === 'reset') {
        this.bufferIndex = 0;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) return true;
    const channel = input[0];
    let i = 0;
    while (i < channel.length) {
      const remaining = this.bufferSize - this.bufferIndex;
      const toCopy = remaining < (channel.length - i) ? remaining : (channel.length - i);
      this.buffer.set(channel.subarray(i, i + toCopy), this.bufferIndex);
      this.bufferIndex += toCopy;
      i += toCopy;
      if (this.bufferIndex === this.bufferSize) {
        this.port.postMessage(this.buffer.slice(0));
        this.bufferIndex = 0;
      }
    }
    return true;
  }
}

registerProcessor('voice-capture-processor', VoiceCaptureProcessor);
