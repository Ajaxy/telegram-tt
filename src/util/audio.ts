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
  const coverUrl = cover ? `data:${cover.format};base64,${cover.data.toString('base64')}` : undefined;

  return {
    title,
    performer: artist,
    duration,
    coverUrl,
  };
}
