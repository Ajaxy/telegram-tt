import type { Size } from '../render/transform';

const AVC_CODECS = ['avc1.640028', 'avc1.4d4028', 'avc1.42001f'];
const PROBE_BITRATE = 2_000_000;
const PROBE_FRAME_RATE = 30;

const cache = new Map<string, Promise<boolean>>();

export function checkCanEncodeVideo(size: Size) {
  const key = `${size.width}x${size.height}`;
  let result = cache.get(key);
  if (!result) {
    result = detectCanEncodeVideo(size);
    cache.set(key, result);
  }

  return result;
}

async function detectCanEncodeVideo({ width, height }: Size) {
  if (typeof VideoEncoder === 'undefined' || typeof OffscreenCanvas === 'undefined') return false;

  for (const codec of AVC_CODECS) {
    try {
      const { supported } = await VideoEncoder.isConfigSupported({
        codec, width, height, bitrate: PROBE_BITRATE, framerate: PROBE_FRAME_RATE,
      });
      if (supported) return true;
    } catch {
      // Unsupported configuration throws in some browsers
    }
  }

  return false;
}
