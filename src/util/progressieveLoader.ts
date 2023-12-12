const DEFAULT_CHUNK_SIZE = 256 * 1024;
export async function* makeProgressiveLoader(
  url: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
): AsyncGenerator<ArrayBuffer, void, undefined> {
  let start = 0;
  let fileSize: number | undefined;

  while (true) {
    let end = start + chunkSize - 1;
    if (fileSize && end > fileSize) {
      end = fileSize - 1;
    }

    const res = await fetch(url, {
      headers: { Range: `bytes=${start}-${end}` },
    });

    if (!res.ok) return;

    // If fileSize is not yet defined, retrieve it from the first chunk's response
    if (!fileSize) {
      const contentRange = res.headers.get('Content-Range');
      const match = contentRange?.match(/\/(\d+)$/);
      fileSize = match ? Number(match[1]) : undefined;

      if (!fileSize) return;
    }

    // Yield the chunk data
    const chunk = await res.arrayBuffer();
    yield chunk;

    start = end + 1;

    if (start >= fileSize) {
      return;
    }
  }
}
