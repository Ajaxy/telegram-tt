import type { AudioCodec, InputAudioTrack } from 'mediabunny';
import { canEncodeAudio, Mp4OutputFormat } from 'mediabunny';

import type { VideoAudioHandling, VideoProbe } from '../../components/ui/mediaEditor/types';

import { createInput } from './input';

const PACKET_STATS_COUNT = 100;
const MP4_AUDIO_CODECS = new Mp4OutputFormat().getSupportedAudioCodecs();
const COPIED_AUDIO_CODECS: AudioCodec[] = ['aac', 'mp3'];

export async function probe(file: Blob): Promise<VideoProbe | undefined> {
  const input = createInput(file);

  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) return undefined;

    const audioTrack = await input.getPrimaryAudioTrack();
    const [duration, stats, canDecodeVideo, width, height, audioHandling, audioBitrate] = await Promise.all([
      input.computeDuration(),
      videoTrack.computePacketStats(PACKET_STATS_COUNT),
      videoTrack.canDecode(),
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
      getAudioHandling(audioTrack),
      audioTrack?.getAverageBitrate(),
    ]);

    return {
      width,
      height,
      duration,
      frameRate: stats.averagePacketRate,
      videoBitrate: stats.averageBitrate || (file.size * 8) / duration,
      audioBitrate: audioBitrate || undefined,
      canDecodeVideo,
      audioHandling,
    };
  } catch {
    return undefined;
  } finally {
    input.dispose();
  }
}

export async function getAudioHandling(track: InputAudioTrack | null): Promise<VideoAudioHandling> {
  if (!track) return 'none';

  const codec = await track.getCodec();
  if (codec && COPIED_AUDIO_CODECS.includes(codec)) return 'copy';
  if (await track.canDecode() && await canEncodeAudio('aac')) return 'transcode';
  if (codec && MP4_AUDIO_CODECS.includes(codec)) return 'copy';

  return 'unsupported';
}
