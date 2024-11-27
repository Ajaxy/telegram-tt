import { MAX_EMPTY_WAVEFORM_POINTS } from '../components/common/helpers/waveform';

export function generateWaveform(duration: number) {
  const arr = Math.min(Math.round(duration), MAX_EMPTY_WAVEFORM_POINTS);
  return Array.from({ length: arr }, () => Math.floor(Math.random() * 256));
}
