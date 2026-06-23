import { fetchBlob } from './files';

type AudioMetadata = {
  title?: string;
  performer?: string;
  duration?: number;
  coverUrl?: string;
};

export async function parseAudioMetadata(url: string): Promise<AudioMetadata> {
  const { parseBlob, selectCover } = await import('music-metadata');
  const blob = await fetchBlob(url);
  const metadata = await parseBlob(blob);
  const { common: { title, artist, picture }, format: { duration } } = metadata;

  const cover = selectCover(picture);
  const coverBlob = cover ? new Blob([cover.data as Uint8Array<ArrayBuffer>], { type: cover.format }) : undefined;
  const coverUrl = coverBlob ? URL.createObjectURL(coverBlob) : undefined;

  return {
    title,
    performer: artist,
    duration,
    coverUrl,
  };
}
