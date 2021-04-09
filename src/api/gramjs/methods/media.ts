import { inflate } from 'pako/dist/pako_inflate';

import { Api as GramJs, TelegramClient } from '../../../lib/gramjs';
import {
  ApiMediaFormat, ApiOnProgress, ApiParsedMedia, ApiPreparedMedia,
} from '../../types';

import {
  DOWNLOAD_WORKERS,
  MEDIA_CACHE_DISABLED,
  MEDIA_CACHE_MAX_BYTES,
  MEDIA_CACHE_NAME,
  MEDIA_CACHE_NAME_AVATARS,
} from '../../../config';
import localDb from '../localDb';
import { getEntityTypeById } from '../gramjsBuilders';
import { blobToDataUri } from '../../../util/files';
import * as cacheApi from '../../../util/cacheApi';

type EntityType = 'msg' | 'sticker' | 'wallpaper' | 'gif' | 'channel' | 'chat' | 'user' | 'stickerSet';

export default async function downloadMedia(
  {
    url, mediaFormat, start, end,
  }: {
    url: string; mediaFormat: ApiMediaFormat; start?: number; end?: number;
  },
  client: TelegramClient,
  isConnected: boolean,
  onProgress?: ApiOnProgress,
) {
  const {
    data, mimeType, fullSize,
  } = await download(url, client, isConnected, onProgress, start, end, mediaFormat) || {};
  if (!data) {
    return undefined;
  }

  const parsed = await parseMedia(data, mediaFormat, mimeType);
  if (!parsed) {
    return undefined;
  }

  const canCache = mediaFormat !== ApiMediaFormat.Progressive && (
    mediaFormat !== ApiMediaFormat.BlobUrl || (parsed as Blob).size <= MEDIA_CACHE_MAX_BYTES
  );

  if (!MEDIA_CACHE_DISABLED && cacheApi && canCache) {
    const cacheName = url.startsWith('avatar') ? MEDIA_CACHE_NAME_AVATARS : MEDIA_CACHE_NAME;
    void cacheApi.save(cacheName, url, parsed);
  }

  const prepared = mediaFormat === ApiMediaFormat.Progressive ? '' : prepareMedia(parsed);
  const arrayBuffer = mediaFormat === ApiMediaFormat.Progressive ? parsed as ArrayBuffer : undefined;

  return {
    prepared,
    arrayBuffer,
    mimeType,
    fullSize,
  };
}

async function download(
  url: string,
  client: TelegramClient,
  isConnected: boolean,
  onProgress?: ApiOnProgress,
  start?: number,
  end?: number,
  mediaFormat?: ApiMediaFormat,
) {
  const mediaMatch = url.match(/(avatar|profile|msg|stickerSet|sticker|wallpaper|gif|file)([-\d\w./]+)(\?size=\w+)?/);
  if (!mediaMatch) {
    return undefined;
  }

  if (mediaMatch[1] === 'file') {
    const response = await fetch(mediaMatch[2]);
    const data = await response.arrayBuffer();
    return { data };
  }

  if (!isConnected) {
    return Promise.reject(new Error('ERROR: Client is not connected'));
  }

  let entityType: EntityType;
  let entityId: string | number = mediaMatch[2];
  const sizeType = mediaMatch[3] ? mediaMatch[3].replace('?size=', '') : undefined;
  let entity: (
    GramJs.User | GramJs.Chat | GramJs.Channel |
    GramJs.Message | GramJs.Document | GramJs.StickerSet | undefined
  );

  if (mediaMatch[1] === 'avatar' || mediaMatch[1] === 'profile') {
    entityType = getEntityTypeById(Number(entityId));
    entityId = Math.abs(Number(entityId));
  } else {
    entityType = mediaMatch[1] as 'msg' | 'sticker' | 'wallpaper' | 'gif' | 'stickerSet';
  }

  switch (entityType) {
    case 'channel':
    case 'chat':
      entity = localDb.chats[entityId as number];
      break;
    case 'user':
      entity = localDb.users[entityId as number];
      break;
    case 'msg':
      entity = localDb.messages[entityId as string];
      break;
    case 'sticker':
    case 'gif':
    case 'wallpaper':
      entity = localDb.documents[entityId as string];
      break;
    case 'stickerSet':
      entity = localDb.stickerSets[entityId as string];
      break;
  }

  if (!entity) {
    return undefined;
  }

  if (entityType === 'msg' || entityType === 'sticker' || entityType === 'gif' || entityType === 'wallpaper') {
    if (mediaFormat === ApiMediaFormat.Stream) {
      onProgress!.acceptsBuffer = true;
    }

    const data = await client.downloadMedia(entity, {
      sizeType, start, end, progressCallback: onProgress, workers: DOWNLOAD_WORKERS,
    });
    let mimeType;
    let fullSize;

    if (entity instanceof GramJs.Message) {
      mimeType = getMessageMediaMimeType(entity, sizeType);
      if (entity.media instanceof GramJs.MessageMediaDocument && entity.media.document instanceof GramJs.Document) {
        fullSize = entity.media.document.size;
      }
    } else if (entityType === 'sticker' && sizeType) {
      mimeType = 'image/webp';
    } else {
      mimeType = (entity as GramJs.Document).mimeType;
      fullSize = (entity as GramJs.Document).size;
    }

    return { mimeType, data, fullSize };
  } else if (entityType === 'stickerSet') {
    const data = await client.downloadStickerSetThumb(entity);
    const mimeType = mediaFormat === ApiMediaFormat.Lottie ? 'application/json' : 'image/jpeg';

    return { mimeType, data };
  } else {
    const data = await client.downloadProfilePhoto(entity, mediaMatch[1] === 'profile');
    const mimeType = 'image/jpeg';

    return { mimeType, data };
  }
}

function getMessageMediaMimeType(message: GramJs.Message, sizeType?: string) {
  if (!message || !message.media) {
    return undefined;
  }

  if (message.media instanceof GramJs.MessageMediaPhoto) {
    return 'image/jpeg';
  }

  if (message.media instanceof GramJs.MessageMediaDocument && message.media.document instanceof GramJs.Document) {
    if (sizeType) {
      return message.media.document!.attributes.some((a) => a instanceof GramJs.DocumentAttributeSticker)
        ? 'image/webp'
        : 'image/jpeg';
    }

    return message.media.document!.mimeType;
  }

  return undefined;
}

// eslint-disable-next-line no-async-without-await/no-async-without-await
async function parseMedia(
  data: Buffer, mediaFormat: ApiMediaFormat, mimeType?: string,
): Promise<ApiParsedMedia | undefined> {
  switch (mediaFormat) {
    case ApiMediaFormat.DataUri:
      return blobToDataUri(new Blob([data], { type: mimeType }));
    case ApiMediaFormat.BlobUrl:
      return new Blob([data], { type: mimeType });
    case ApiMediaFormat.Lottie: {
      const json = inflate(data, { to: 'string' });
      return JSON.parse(json);
    }
    case ApiMediaFormat.Progressive: {
      return data.buffer;
    }
  }

  return undefined;
}

function prepareMedia(mediaData: ApiParsedMedia): ApiPreparedMedia {
  if (mediaData instanceof Blob) {
    return URL.createObjectURL(mediaData);
  }

  return mediaData;
}
