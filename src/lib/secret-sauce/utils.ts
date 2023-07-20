import type { P2PPayloadType } from './p2pMessage';
import type { PayloadType } from './types';

/// NOTE: telegram returns sign source, while webrtc uses unsign source internally
/// unsign => sign
export function toTelegramSource(source: number) {
  // eslint-disable-next-line no-bitwise
  return source << 0;
}

/// NOTE: telegram returns sign source, while webrtc uses unsign source internally
/// sign => unsign
export function fromTelegramSource(source: number) {
  // eslint-disable-next-line no-bitwise
  return source >>> 0;
}

export function getAmplitude(array: Uint8Array, scale = 3) {
  if (!array) return 0;

  const { length } = array;
  let total = 0;
  for (let i = 0; i < length; i++) {
    total += array[i] * array[i];
  }
  const rms = Math.sqrt(total / length) / 255;

  return Math.min(1, rms * scale);
}

export function p2pPayloadTypeToConference(p: P2PPayloadType): PayloadType {
  return {
    id: p.id,
    name: p.name,
    'rtcp-fbs': p.feedbackTypes,
    clockrate: p.clockrate,
    parameters: p.parameters,
    channels: p.channels,
  };
}

export function isRelayAddress(candidate: string) {
  const parts = candidate.split(' ');
  return parts.some((part) => part === 'relay');
}

export function removeRelatedAddress(candidate: string) {
  const parts = candidate.split(' ');

  const raddrIndex = parts.indexOf('raddr');
  if (raddrIndex !== -1) {
    parts.splice(raddrIndex, 2);
  }

  const rportIndex = parts.indexOf('rport');
  if (rportIndex !== -1) {
    parts.splice(rportIndex, 2);
  }

  return parts.join(' ');
}

export const THRESHOLD = 0.1;

export const IS_SCREENSHARE_SUPPORTED = 'getDisplayMedia' in (navigator?.mediaDevices || {});
export const IS_ECHO_CANCELLATION_SUPPORTED = navigator?.mediaDevices?.getSupportedConstraints().echoCancellation;
// @ts-ignore
export const IS_NOISE_SUPPRESSION_SUPPORTED = navigator?.mediaDevices?.getSupportedConstraints().noiseSuppression;
