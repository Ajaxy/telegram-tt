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
import * as cacheApi from '../../../util/cacheApi';

type EntityType = (
  'msg' | 'sticker' | 'wallpaper' | 'gif' | 'channel' | 'chat' | 'user' | 'photo' | 'stickerSet' | 'webDocument' |
  'document'
);

const MEDIA_ENTITY_TYPES = new Set(['msg', 'sticker', 'gif', 'wallpaper', 'photo', 'webDocument', 'document']);
const TGS_MIME_TYPE = 'application/x-tgsticker';

export default async function downloadMedia(
  {
    url, mediaFormat, start, end, isHtmlAllowed,
  }: {
    url: string; mediaFormat: ApiMediaFormat; start?: number; end?: number; isHtmlAllowed?: boolean;
  },
  client: TelegramClient,
  isConnected: boolean,
  onProgress?: ApiOnProgress,
) {
  const {
    data, mimeType, fullSize,
  } = await download(url, client, isConnected, onProgress, start, end, mediaFormat, isHtmlAllowed) || {};
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

  const prepared = mediaFormat === ApiMediaFormat.Progressive ? '' : prepareMedia(parsed as string | Blob);
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
  isHtmlAllowed?: boolean,
) {
  const mediaMatch = url.startsWith('staticMap')
    ? url.match(/(staticMap):([0-9-]+)(\?.+)/)
    : url.startsWith('webDocument')
      ? url.match(/(webDocument):(.+)/)
      : url.match(
        /(avatar|profile|photo|msg|stickerSet|sticker|wallpaper|gif|file|document)([-\d\w./]+)(?::\d+)?(\?size=\w+)?/,
      );
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
  const entityId: string | number = mediaMatch[2];
  const sizeType = mediaMatch[3] ? mediaMatch[3].replace('?size=', '') : undefined;
  let entity: (
    GramJs.User | GramJs.Chat | GramJs.Channel | GramJs.Photo |
    GramJs.Message | GramJs.MessageService |
    GramJs.Document | GramJs.StickerSet | GramJs.TypeWebDocument | undefined
  );

  if (mediaMatch[1] === 'staticMap') {
    const accessHash = mediaMatch[2];
    const params = mediaMatch[3];
    const parsedParams = new URLSearchParams(params);
    const long = parsedParams.get('long');
    const lat = parsedParams.get('lat');
    const w = parsedParams.get('w');
    const h = parsedParams.get('h');
    const zoom = parsedParams.get('zoom');
    const scale = parsedParams.get('scale');
    const accuracyRadius = parsedParams.get('accuracy_radius');

    const data = await client.downloadStaticMap(accessHash, long, lat, w, h, zoom, scale, accuracyRadius);
    return {
      mimeType: 'image/png',
      data,
    };
  }

  if (mediaMatch[1] === 'avatar' || mediaMatch[1] === 'profile') {
    entityType = getEntityTypeById(entityId);
  } else {
    entityType = mediaMatch[1] as (
      'msg' | 'sticker' | 'wallpaper' | 'gif' | 'stickerSet' | 'photo' | 'webDocument' | 'document'
    );
  }

  switch (entityType) {
    case 'channel':
    case 'chat':
      entity = localDb.chats[entityId];
      break;
    case 'user':
      entity = localDb.users[entityId];
      break;
    case 'msg':
      entity = localDb.messages[entityId];
      break;
    case 'sticker':
    case 'gif':
    case 'wallpaper':
      entity = localDb.documents[entityId];
      break;
    case 'photo':
      entity = localDb.photos[entityId];
      break;
    case 'stickerSet':
      entity = localDb.stickerSets[entityId];
      break;
    case 'webDocument':
      entity = localDb.webDocuments[entityId];
      break;
    case 'document':
      entity = localDb.documents[entityId];
      break;
  }

  if (!entity) {
    return undefined;
  }

  if (MEDIA_ENTITY_TYPES.has(entityType)) {
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
      if (entity.media instanceof GramJs.MessageMediaWebPage
        && entity.media.webpage instanceof GramJs.WebPage
        && entity.media.webpage.document instanceof GramJs.Document) {
        fullSize = entity.media.webpage.document.size;
      }
    } else if (entity instanceof GramJs.Photo) {
      mimeType = 'image/jpeg';
    } else if (entityType === 'sticker' && sizeType) {
      mimeType = 'image/webp';
    } else if (entityType === 'webDocument') {
      mimeType = (entity as GramJs.TypeWebDocument).mimeType;
    } else {
      mimeType = (entity as GramJs.Document).mimeType;
      fullSize = (entity as GramJs.Document).size;
    }

    // Prevent HTML-in-video attacks
    if (!isHtmlAllowed && mimeType) {
      mimeType = mimeType.replace(/html/gi, '');
    }

    return { mimeType, data, fullSize };
  } else if (entityType === 'stickerSet') {
    const data = await client.downloadStickerSetThumb(entity);
    const mimeType = mediaFormat === ApiMediaFormat.Lottie ? TGS_MIME_TYPE : getMimeType(data);

    return { mimeType, data };
  } else {
    const data = await client.downloadProfilePhoto(entity, mediaMatch[1] === 'profile');
    const mimeType = getMimeType(data);

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

  if (message.media instanceof GramJs.MessageMediaGeo
    || message.media instanceof GramJs.MessageMediaVenue
    || message.media instanceof GramJs.MessageMediaGeoLive) {
    return 'image/png';
  }

  if (message.media instanceof GramJs.MessageMediaDocument && message.media.document instanceof GramJs.Document) {
    if (sizeType) {
      return message.media.document!.attributes.some((a) => a instanceof GramJs.DocumentAttributeSticker)
        ? 'image/webp'
        : 'image/jpeg';
    }

    return message.media.document!.mimeType;
  }

  if (message.media instanceof GramJs.MessageMediaWebPage
    && message.media.webpage instanceof GramJs.WebPage
    && message.media.webpage.document instanceof GramJs.Document) {
    if (sizeType) {
      return 'image/jpeg';
    }

    return message.media.webpage.document.mimeType;
  }

  return undefined;
}

// eslint-disable-next-line no-async-without-await/no-async-without-await
async function parseMedia(
  data: Buffer, mediaFormat: ApiMediaFormat, mimeType?: string,
): Promise<ApiParsedMedia | undefined> {
  switch (mediaFormat) {
    case ApiMediaFormat.BlobUrl:
    case ApiMediaFormat.Lottie: {
      return new Blob([data], { type: mimeType });
    }
    case ApiMediaFormat.Progressive: {
      return data.buffer;
    }
  }

  return undefined;
}

function prepareMedia(mediaData: Exclude<ApiParsedMedia, ArrayBuffer>): ApiPreparedMedia {
  if (mediaData instanceof Blob) {
    return URL.createObjectURL(mediaData);
  }

  return mediaData;
}

function getMimeType(data: Uint8Array, fallbackMimeType = 'image/jpeg') {
  if (data.length < 4) {
    return fallbackMimeType;
  }

  let type = fallbackMimeType;
  const signature = data.subarray(0, 4).reduce((result, byte) => result + byte.toString(16), '');

  // https://en.wikipedia.org/wiki/List_of_file_signatures
  switch (signature) {
    case '89504e47':
      type = 'image/png';
      break;
    case '47494638':
      type = 'image/gif';
      break;
    case 'ffd8ffe0':
    case 'ffd8ffe1':
    case 'ffd8ffe2':
    case 'ffd8ffe3':
    case 'ffd8ffe8':
      type = 'image/jpeg';
      break;
    case '52494646':
      // In our case only webp is expected
      type = 'image/webp';
      break;
  }

  return type;
}
