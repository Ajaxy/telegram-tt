import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiSticker, ApiStickerSetInfo, ApiVideo,
} from '../../types';

import { DEFAULT_GIF_SEARCH_BOT_USERNAME, RECENT_STATUS_LIMIT, RECENT_STICKERS_LIMIT } from '../../../config';
import { buildVideoFromDocument } from '../apiBuilders/messageContent';
import { buildApiEmojiStatus } from '../apiBuilders/peers';
import {
  buildStickerSet, buildStickerSetCovered, processStickerPackResult, processStickerResult,
} from '../apiBuilders/symbols';
import { buildInputDocument, buildInputStickerSet, buildInputStickerSetShortName } from '../gramjsBuilders';
import localDb from '../localDb';
import { sendApiUpdate } from '../updates/apiUpdateEmitter';
import { invokeRequest } from './client';

export async function fetchCustomEmojiSets({ hash = '0' }: { hash?: string }) {
  const allStickers = await invokeRequest(new GramJs.messages.GetEmojiStickers({ hash: BigInt(hash) }));

  if (!allStickers || allStickers instanceof GramJs.messages.AllStickersNotModified) {
    return undefined;
  }

  allStickers.sets.forEach((stickerSet) => {
    if (stickerSet.thumbs?.length || stickerSet.thumbDocumentId) {
      localDb.stickerSets[String(stickerSet.id)] = stickerSet;
    }
  });

  return {
    hash: String(allStickers.hash),
    sets: allStickers.sets.map(buildStickerSet),
  };
}

export async function fetchStickerSets({ hash = '0' }: { hash?: string }) {
  const allStickers = await invokeRequest(new GramJs.messages.GetAllStickers({ hash: BigInt(hash) }));

  if (!allStickers || allStickers instanceof GramJs.messages.AllStickersNotModified) {
    return undefined;
  }

  allStickers.sets.forEach((stickerSet) => {
    if (stickerSet.thumbs?.length) {
      localDb.stickerSets[String(stickerSet.id)] = stickerSet;
    }
  });

  return {
    hash: String(allStickers.hash),
    sets: allStickers.sets.map(buildStickerSet),
  };
}

export async function fetchRecentStickers({ hash = '0' }: { hash?: string }) {
  const result = await invokeRequest(new GramJs.messages.GetRecentStickers({ hash: BigInt(hash) }));

  if (!result || result instanceof GramJs.messages.RecentStickersNotModified) {
    return undefined;
  }

  return {
    hash: String(result.hash),
    stickers: processStickerResult(result.stickers.slice(0, RECENT_STICKERS_LIMIT)),
  };
}

export async function fetchFavoriteStickers({ hash = '0' }: { hash?: string }) {
  const result = await invokeRequest(new GramJs.messages.GetFavedStickers({ hash: BigInt(hash) }));

  if (!result || result instanceof GramJs.messages.FavedStickersNotModified) {
    return undefined;
  }

  return {
    hash: String(result.hash),
    stickers: processStickerResult(result.stickers),
  };
}

export async function fetchFeaturedStickers({ hash = '0' }: { hash?: string }) {
  const result = await invokeRequest(new GramJs.messages.GetFeaturedStickers({ hash: BigInt(hash) }));

  if (!result || result instanceof GramJs.messages.FeaturedStickersNotModified) {
    return undefined;
  }

  return {
    hash: String(result.hash),
    isPremium: Boolean(result.premium),
    sets: result.sets.map(buildStickerSetCovered),
  };
}

export async function fetchFeaturedEmojiStickers() {
  const result = await invokeRequest(new GramJs.messages.GetFeaturedEmojiStickers({ hash: BigInt(0) }));

  if (!result || result instanceof GramJs.messages.FeaturedStickersNotModified) {
    return undefined;
  }

  result.sets.forEach(({ set }) => {
    if (set.thumbDocumentId) {
      localDb.stickerSets[String(set.id)] = set;
    }
  });

  return {
    isPremium: Boolean(result.premium),
    sets: result.sets.map(buildStickerSetCovered),
  };
}

export async function faveSticker({
  sticker,
  unfave,
}: {
  sticker: ApiSticker;
  unfave?: boolean;
}) {
  const request = new GramJs.messages.FaveSticker({
    id: buildInputDocument(sticker),
    unfave,
  });

  const result = await invokeRequest(request);
  if (result) {
    sendApiUpdate({
      '@type': 'updateFavoriteStickers',
    });
  }
}

export function removeRecentSticker({
  sticker,
}: {
  sticker: ApiSticker;
}) {
  const request = new GramJs.messages.SaveRecentSticker({
    id: buildInputDocument(sticker),
    unsave: true,
  });

  return invokeRequest(request);
}

export function clearRecentStickers() {
  return invokeRequest(new GramJs.messages.ClearRecentStickers());
}

export async function fetchStickers(
  { stickerSetInfo }:
  { stickerSetInfo: ApiStickerSetInfo },
) {
  if ('isMissing' in stickerSetInfo) return undefined;
  const result = await invokeRequest(new GramJs.messages.GetStickerSet({
    stickerset: 'id' in stickerSetInfo
      ? buildInputStickerSet(stickerSetInfo.id, stickerSetInfo.accessHash)
      : buildInputStickerSetShortName(stickerSetInfo.shortName),
  }), {
    shouldThrow: true,
  });

  if (!(result instanceof GramJs.messages.StickerSet)) {
    return undefined;
  }

  localDb.stickerSets[String(result.set.id)] = result.set;

  return {
    set: buildStickerSet(result.set),
    stickers: processStickerResult(result.documents),
    packs: processStickerPackResult(result.packs),
  };
}

export async function fetchCustomEmoji({ documentId }: { documentId: string[] }) {
  if (!documentId.length) return undefined;
  const result = await invokeRequest(new GramJs.messages.GetCustomEmojiDocuments({
    documentId: documentId.map((id) => BigInt(id)),
  }));
  if (!result) return undefined;

  return processStickerResult(result);
}

export async function fetchAnimatedEmojis() {
  const result = await invokeRequest(new GramJs.messages.GetStickerSet({
    stickerset: new GramJs.InputStickerSetAnimatedEmoji(),
  }));

  if (!(result instanceof GramJs.messages.StickerSet)) {
    return undefined;
  }

  return {
    set: buildStickerSet(result.set),
    stickers: processStickerResult(result.documents),
  };
}

export async function fetchAnimatedEmojiEffects() {
  const result = await invokeRequest(new GramJs.messages.GetStickerSet({
    stickerset: new GramJs.InputStickerSetAnimatedEmojiAnimations(),
  }));

  if (!(result instanceof GramJs.messages.StickerSet)) {
    return undefined;
  }

  return {
    set: buildStickerSet(result.set),
    stickers: processStickerResult(result.documents),
  };
}

export async function fetchGenericEmojiEffects() {
  const result = await invokeRequest(new GramJs.messages.GetStickerSet({
    stickerset: new GramJs.InputStickerSetEmojiGenericAnimations(),
  }));

  if (!(result instanceof GramJs.messages.StickerSet)) {
    return undefined;
  }

  return {
    set: buildStickerSet(result.set),
    stickers: processStickerResult(result.documents),
  };
}

export async function fetchPremiumGifts() {
  const result = await invokeRequest(new GramJs.messages.GetStickerSet({
    stickerset: new GramJs.InputStickerSetPremiumGifts(),
  }));

  if (!(result instanceof GramJs.messages.StickerSet)) {
    return undefined;
  }

  return {
    set: buildStickerSet(result.set),
    stickers: processStickerResult(result.documents),
  };
}

export async function fetchDefaultTopicIcons() {
  const result = await invokeRequest(new GramJs.messages.GetStickerSet({
    stickerset: new GramJs.InputStickerSetEmojiDefaultTopicIcons(),
  }));

  if (!(result instanceof GramJs.messages.StickerSet)) {
    return undefined;
  }

  return {
    set: buildStickerSet(result.set),
    stickers: processStickerResult(result.documents),
  };
}

export async function fetchDefaultStatusEmojis() {
  const result = await invokeRequest(new GramJs.messages.GetStickerSet({
    stickerset: new GramJs.InputStickerSetEmojiDefaultStatuses(),
  }));

  if (!(result instanceof GramJs.messages.StickerSet)) {
    return undefined;
  }

  return {
    set: buildStickerSet(result.set),
    stickers: processStickerResult(result.documents),
  };
}

export async function fetchCollectibleEmojiStatuses({ hash = '0' }: { hash?: string }) {
  const result = await invokeRequest(new GramJs.account.GetCollectibleEmojiStatuses(
    { hash: BigInt(hash) },
  ));

  if (!(result instanceof GramJs.account.EmojiStatuses)) {
    return undefined;
  }

  const statuses = result.statuses.map(buildApiEmojiStatus).filter(Boolean);

  return {
    statuses,
    hash: String(result.hash),
  };
}

export async function searchStickers({ query, hash = '0' }: { query: string; hash?: string }) {
  const result = await invokeRequest(new GramJs.messages.SearchStickerSets({
    q: query,
    hash: BigInt(hash),
  }));

  if (!result || result instanceof GramJs.messages.FoundStickerSetsNotModified) {
    return undefined;
  }

  return {
    hash: String(result.hash),
    sets: result.sets.map(buildStickerSetCovered),
  };
}

export async function fetchSavedGifs({ hash = '0' }: { hash?: string }) {
  const result = await invokeRequest(new GramJs.messages.GetSavedGifs({ hash: BigInt(hash) }));

  if (!result || result instanceof GramJs.messages.SavedGifsNotModified) {
    return undefined;
  }

  return {
    hash: String(result.hash),
    gifs: processGifResult(result.gifs),
  };
}

export function saveGif({ gif, shouldUnsave }: { gif: ApiVideo; shouldUnsave?: boolean }) {
  const request = new GramJs.messages.SaveGif({
    id: buildInputDocument(gif),
    unsave: shouldUnsave,
  });

  return invokeRequest(request, { shouldReturnTrue: true });
}

export async function installStickerSet({ stickerSetId, accessHash }: { stickerSetId: string; accessHash: string }) {
  const result = await invokeRequest(new GramJs.messages.InstallStickerSet({
    stickerset: buildInputStickerSet(stickerSetId, accessHash),
  }));

  if (result) {
    sendApiUpdate({
      '@type': 'updateStickerSet',
      id: stickerSetId,
      stickerSet: { installedDate: Date.now() },
    });
  }
}

export async function uninstallStickerSet({ stickerSetId, accessHash }: { stickerSetId: string; accessHash: string }) {
  const result = await invokeRequest(new GramJs.messages.UninstallStickerSet({
    stickerset: buildInputStickerSet(stickerSetId, accessHash),
  }));

  if (result) {
    sendApiUpdate({
      '@type': 'updateStickerSet',
      id: stickerSetId,
      stickerSet: { installedDate: undefined },
    });
  }
}

let inputGifBot: GramJs.InputUser | undefined;

export async function searchGifs({
  query,
  offset = '',
  username = DEFAULT_GIF_SEARCH_BOT_USERNAME,
}: { query: string; offset?: string; username?: string }) {
  if (!inputGifBot) {
    const resolvedPeer = await invokeRequest(new GramJs.contacts.ResolveUsername({
      username,
    }));
    if (!resolvedPeer || !(resolvedPeer.users[0] instanceof GramJs.User)) {
      return undefined;
    }

    inputGifBot = new GramJs.InputUser({
      userId: (resolvedPeer.peer as GramJs.PeerUser).userId,
      accessHash: resolvedPeer.users[0].accessHash!,
    });
  }

  const result = await invokeRequest(new GramJs.messages.GetInlineBotResults({
    bot: inputGifBot,
    peer: new GramJs.InputPeerEmpty(),
    query,
    offset,
  }));
  if (!result) {
    return undefined;
  }

  const documents = result.results
    .map((foundGif) => {
      if (foundGif instanceof GramJs.BotInlineMediaResult) {
        return foundGif.document;
      }

      return undefined;
    })
    .filter(Boolean);

  return {
    nextOffset: result.nextOffset,
    gifs: processGifResult(documents),
  };
}

export async function fetchStickersForEmoji({
  emoji, hash = '0',
}: { emoji: string; hash?: string }) {
  const result = await invokeRequest(new GramJs.messages.GetStickers({
    emoticon: emoji,
    hash: BigInt(hash),
  }));

  if (!result || result instanceof GramJs.messages.StickersNotModified) {
    return undefined;
  }

  return {
    stickers: processStickerResult(result.stickers),
    hash: String(result.hash),
  };
}

export async function fetchEmojiKeywords({ language, fromVersion }: {
  language: string;
  fromVersion?: number;
}) {
  const result = await invokeRequest(new GramJs.messages.GetEmojiKeywordsDifference({
    langCode: language,
    fromVersion,
  }));

  if (!result) {
    return undefined;
  }

  return {
    language: result.langCode,
    version: result.version,
    keywords: result.keywords.reduce((acc, emojiKeyword) => {
      acc[emojiKeyword.keyword] = emojiKeyword.emoticons;

      return acc;
    }, {} as Record<string, string[]>),
  };
}

export async function fetchRecentEmojiStatuses(hash = '0') {
  const result = await invokeRequest(new GramJs.account.GetRecentEmojiStatuses({ hash: BigInt(hash) }));

  if (!result || result instanceof GramJs.account.EmojiStatusesNotModified) {
    return undefined;
  }

  const documentIds = result.statuses
    .slice(0, RECENT_STATUS_LIMIT)
    .map(buildApiEmojiStatus)
    .filter(Boolean)
    .map(({ documentId }) => documentId);
  const emojiStatuses = await fetchCustomEmoji({ documentId: documentIds });

  return {
    hash: String(result.hash),
    emojiStatuses,
  };
}

function processGifResult(gifs: GramJs.TypeDocument[]) {
  return gifs
    .map((document) => {
      if (document instanceof GramJs.Document) {
        const gif = buildVideoFromDocument(document);
        if (gif) {
          localDb.documents[String(document.id)] = document;

          return gif;
        }
      }

      return undefined;
    })
    .filter(Boolean);
}
