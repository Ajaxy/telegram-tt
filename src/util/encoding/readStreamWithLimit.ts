import { concat } from './buffer';

// Returns `undefined` once the stream yields more than `maxBytes`, without buffering the rest
export async function readStreamWithLimit(stream: ReadableStream<Uint8Array>, maxBytes: number) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    total += value.length;
    if (total > maxBytes) {
      void reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }

  return concat(...chunks);
}
