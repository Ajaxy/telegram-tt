type AudioMetadata = {
  title?: string;
  performer?: string;
  duration?: number;
  coverUrl?: string;
};

export async function parseAudioMetadata(url: string): Promise<AudioMetadata> {
  const { fetchFromUrl, selectCover } = await import('../lib/music-metadata-browser');
  const metadata = await fetchFromUrl(url);
  const { common: { title, artist, picture }, format: { duration } } = metadata;

  const cover = selectCover(picture);
  const coverBlob = cover ? new Blob([cover.data], { type: cover.format }) : undefined;
  const coverUrl = coverBlob ? URL.createObjectURL(coverBlob) : undefined;

  return {
    title,
    performer: artist,
    duration,
    coverUrl,
  };
}
