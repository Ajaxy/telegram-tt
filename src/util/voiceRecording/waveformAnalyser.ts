export const WAVEFORM_SAMPLES_COUNT = 100;
export const WAVEFORM_BYTES_LENGTH = Math.ceil((WAVEFORM_SAMPLES_COUNT * 5) / 8); // 63
const DOWNSAMPLE_THRESHOLD = WAVEFORM_SAMPLES_COUNT * 2; // 200
const PEAK_SCALE = 32767;
const NORM_PEAK_MULTIPLIER = 1.8;
const MIN_NORM_PEAK = 2500;

export default class WaveformAnalyser {
  onPeak?: (peak: number) => void;

  private peaks: number[] = [];

  private currentPeak = 0;

  private currentPeakCount = 0;

  private peakCompressionFactor = 1;

  private isFinished = false;

  pushSamples(samples: Float32Array) {
    if (this.isFinished) return;

    const len = samples.length;
    let profilePeak = this.currentPeak;
    let count = this.currentPeakCount;
    let blockPeak = 0;

    for (let i = 0; i < len; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > blockPeak) blockPeak = abs;

      const sample = abs * PEAK_SCALE;
      if (sample > profilePeak) profilePeak = sample;
      if (++count === this.peakCompressionFactor) {
        this.peaks.push(profilePeak);
        profilePeak = 0;
        count = 0;

        if (this.peaks.length >= DOWNSAMPLE_THRESHOLD) {
          for (let j = 0; j < WAVEFORM_SAMPLES_COUNT; j++) {
            const a = this.peaks[j * 2];
            const b = this.peaks[j * 2 + 1];
            this.peaks[j] = a > b ? a : b;
          }
          this.peaks.length = WAVEFORM_SAMPLES_COUNT;
          this.peakCompressionFactor *= 2;
        }
      }
    }

    this.currentPeak = profilePeak;
    this.currentPeakCount = count;

    this.onPeak?.(blockPeak);
  }

  // Snapshot of the current per-bucket peaks (raw int amplitudes ~0..32767).
  // The recording UI reads this to show the full waveform during pause/playback
  getCurrentPeaks(): number[] {
    return this.peaks.slice();
  }

  finish(): Uint8Array {
    if (this.isFinished) return new Uint8Array(WAVEFORM_BYTES_LENGTH);
    this.isFinished = true;

    const peaks = downsamplePeaks(this.peaks, WAVEFORM_SAMPLES_COUNT);
    while (peaks.length < WAVEFORM_SAMPLES_COUNT) peaks.push(0);

    let sum = 0;
    for (let i = 0; i < peaks.length; i++) sum += peaks[i];
    let normPeak = (sum * NORM_PEAK_MULTIPLIER) / peaks.length;
    if (normPeak < MIN_NORM_PEAK) normPeak = MIN_NORM_PEAK;

    const result = new Uint8Array(WAVEFORM_BYTES_LENGTH);
    for (let i = 0; i < peaks.length; i++) {
      const clamped = peaks[i] < normPeak ? peaks[i] : normPeak;
      const value = Math.min(31, ((clamped * 31) / normPeak) | 0);
      const bitOffset = i * 5;
      const byteIndex = bitOffset >> 3;
      const bitShift = bitOffset & 7;
      result[byteIndex] |= (value << bitShift) & 0xFF;
      if (bitShift > 3 && byteIndex + 1 < result.length) {
        result[byteIndex + 1] |= (value >> (8 - bitShift)) & 0xFF;
      }
    }

    return result;
  }
}

function downsamplePeaks(peaks: number[], targetCount: number): number[] {
  if (peaks.length <= targetCount) return peaks.slice();

  const ratio = peaks.length / targetCount;
  const result: number[] = [];
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), peaks.length);
    let peak = 0;
    for (let j = start; j < end; j++) {
      if (peaks[j] > peak) peak = peaks[j];
    }
    result.push(peak);
  }

  return result;
}
