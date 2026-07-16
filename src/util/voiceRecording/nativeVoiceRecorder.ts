import OggOpusWriter from './oggOpusWriter';

const WORKLET_PROCESSOR_NAME = 'voice-capture-processor';
const WORKLET_BUFFER_SIZE = 2048;
const ENCODER_SAMPLE_RATE = 48000;
const ENCODER_BITRATE = 32000;
const ENCODER_CHANNELS = 1;
const DEFAULT_FRAME_DURATION_US = 20000;
const DEFAULT_OPUS_FRAME_SAMPLES = (DEFAULT_FRAME_DURATION_US * ENCODER_SAMPLE_RATE) / 1_000_000;

export const ENCODER_CONFIG: AudioEncoderConfig = {
  codec: 'opus',
  sampleRate: ENCODER_SAMPLE_RATE,
  numberOfChannels: ENCODER_CHANNELS,
  bitrate: ENCODER_BITRATE,
};

type RecorderState = 'inactive' | 'recording' | 'paused';

export default class NativeVoiceRecorder {
  sourceNode?: MediaStreamAudioSourceNode;

  state: RecorderState = 'inactive';

  onSamples?: (samples: Float32Array) => void;

  private stream?: MediaStream;

  private audioContext?: AudioContext;

  private workletNode?: AudioWorkletNode;

  private encoder?: AudioEncoder;

  private writer?: OggOpusWriter;

  private encoderTimestampUs = 0;

  private isOpusHeadCaptured = false;

  async start(): Promise<void> {
    if (this.state !== 'inactive') return;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    try {
      this.audioContext = new AudioContext({ sampleRate: ENCODER_SAMPLE_RATE });
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

      await this.audioContext.audioWorklet.addModule(new URL('./recorderWorklet.js?no-inline', import.meta.url));

      this.workletNode = new AudioWorkletNode(this.audioContext, WORKLET_PROCESSOR_NAME, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [ENCODER_CHANNELS],
        processorOptions: { bufferSize: WORKLET_BUFFER_SIZE },
      });

      this.writer = new OggOpusWriter({
        channels: ENCODER_CHANNELS,
        inputSampleRate: ENCODER_SAMPLE_RATE,
      });

      this.encoder = new AudioEncoder({
        output: (chunk, metadata) => this.handleEncoderChunk(chunk, metadata),
        // eslint-disable-next-line no-console
        error: (err) => console.error('[NativeVoiceRecorder] encoder error:', err),
      });

      this.encoder.configure(ENCODER_CONFIG);

      this.workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => this.handleWorkletMessage(e.data);

      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

      this.state = 'recording';
      this.encoderTimestampUs = 0;
      this.isOpusHeadCaptured = false;

      this.audioContext.onstatechange = () => {
        if (this.state !== 'inactive' && this.audioContext?.state === 'suspended') {
          void this.audioContext.resume();
        }
      };
    } catch (err) {
      this.disposeAfterFailedStart();
      throw err;
    }
  }

  private disposeAfterFailedStart() {
    this.state = 'inactive';
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;

    if (this.encoder && this.encoder.state !== 'closed') {
      try {
        this.encoder.close();
      } catch (err) {
        // Already closed
      }
    }
    this.encoder = undefined;

    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close().catch(() => {});
    }
    this.audioContext = undefined;
    this.sourceNode = undefined;
    this.workletNode = undefined;
    this.writer = undefined;
  }

  async pause(): Promise<void> {
    if (this.state !== 'recording') return;
    this.state = 'paused';
    if (this.encoder && this.encoder.state !== 'closed') {
      try {
        await this.encoder.flush();
      } catch (err) {
        // Flush failures are non-fatal for pausing
      }
    }
  }

  resume(): void {
    if (this.state !== 'paused') return;
    // Drop the partial worklet buffer so paused-period audio doesn't bleed into the resumed recording
    this.workletNode?.port.postMessage('reset');
    this.state = 'recording';
  }

  getSnapshot(): Uint8Array {
    return this.writer ? this.writer.snapshot() : new Uint8Array(0);
  }

  async stop(): Promise<Uint8Array> {
    if (this.state === 'inactive') return new Uint8Array(0);
    this.state = 'inactive';

    try {
      this.sourceNode?.disconnect();
    } catch (err) {
      // Already disconnected
    }
    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch (err) {
        // Already disconnected
      }
      this.workletNode.port.onmessage = undefined as unknown as typeof this.workletNode.port.onmessage;
    }

    this.stream?.getTracks().forEach((track) => track.stop());

    if (this.encoder && this.encoder.state !== 'closed') {
      try {
        await this.encoder.flush();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[NativeVoiceRecorder] flush error:', err);
      }
      try {
        this.encoder.close();
      } catch (err) {
        // Already closed
      }
    }

    const ogg = this.writer ? this.writer.finalize() : new Uint8Array(0);

    if (this.audioContext) {
      this.audioContext.onstatechange = undefined as unknown as typeof this.audioContext.onstatechange;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch (err) {
        // Already closed
      }
    }

    return ogg;
  }

  private handleWorkletMessage(samples: Float32Array) {
    if (this.state !== 'recording') return;
    this.onSamples?.(samples);

    const numberOfFrames = samples.length / ENCODER_CHANNELS;
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: ENCODER_SAMPLE_RATE,
      numberOfFrames,
      numberOfChannels: ENCODER_CHANNELS,
      timestamp: this.encoderTimestampUs,
      data: samples.slice(),
    });
    this.encoderTimestampUs += (numberOfFrames * 1_000_000) / ENCODER_SAMPLE_RATE;
    try {
      this.encoder!.encode(audioData);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[NativeVoiceRecorder] encode error:', err);
    }
    audioData.close();
  }

  private handleEncoderChunk(chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) {
    if (!this.isOpusHeadCaptured && metadata?.decoderConfig?.description) {
      const desc = metadata.decoderConfig.description;
      const view = desc as ArrayBufferView;
      const bytes = desc instanceof ArrayBuffer
        ? new Uint8Array(desc)
        : new Uint8Array(view.buffer as ArrayBuffer, view.byteOffset, view.byteLength);
      this.writer!.setOpusHead(bytes);
      this.isOpusHeadCaptured = true;
    }

    const data = new Uint8Array(chunk.byteLength);
    chunk.copyTo(data);

    const durationUs = chunk.duration ?? DEFAULT_FRAME_DURATION_US;
    const durationSamples = Math.round((durationUs * ENCODER_SAMPLE_RATE) / 1_000_000) || DEFAULT_OPUS_FRAME_SAMPLES;
    this.writer!.writePacket(data, durationSamples);
  }
}
