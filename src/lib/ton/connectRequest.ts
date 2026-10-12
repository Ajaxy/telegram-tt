import { bufferFromUtf8 } from '../../util/encoding/buffer';

export const MAX_BODY_BYTES = 1024 * 1024;
export const MAINNET = '-239';

export type TonConnectConnectRequest = {
  manifestUrl: string;
  items: { name: string; payload?: string; network?: string }[];
};

export function parseTonConnectConnectRequest(value: unknown): TonConnectConnectRequest {
  if (!isRecord(value) || typeof value.manifestUrl !== 'string' || !Array.isArray(value.items)
    || !value.items.length || bufferFromUtf8(JSON.stringify(value)).length > MAX_BODY_BYTES) {
    throw new Error('Invalid connect request');
  }

  const url = new URL(value.manifestUrl);

  // The manifest names the app and the proof domain, so only HTTPS keeps it from being altered on the way
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Invalid manifest URL');
  }

  const names = new Set<string>();
  const items = value.items.map((item) => {
    if (!isRecord(item) || typeof item.name !== 'string' || !item.name || names.has(item.name)
      || (item.name === 'ton_proof' && typeof item.payload !== 'string')
      || (item.name === 'ton_addr' && item.network !== undefined && item.network !== MAINNET)) {
      throw new Error('Invalid connect item');
    }

    names.add(item.name);

    return {
      name: item.name,
      payload: typeof item.payload === 'string' ? item.payload : undefined,
      network: typeof item.network === 'string' ? item.network : undefined,
    };
  });
  if (!names.has('ton_addr')) throw new Error('Missing address item');

  return { manifestUrl: url.href, items };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && Boolean(value) && !Array.isArray(value);
}
