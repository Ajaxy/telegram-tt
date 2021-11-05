import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';
import { ApiSticker, ApiVideo, OnApiUpdate } from '../../types';

import { invokeRequest } from './client';
import { buildStickerFromDocument, buildStickerSet, buildStickerSetCovered } from '../apiBuilders/symbols';
import { buildInputStickerSet, buildInputDocument, buildInputStickerSetShortName } from '../gramjsBuilders';
import { buildVideoFromDocument } from '../apiBuilders/messages';
import { RECENT_STICKERS_LIMIT } from '../../../config';

import localDb from '../localDb';

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
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
    onUpdate({
      '@type': 'updateFavoriteStickers',
    });
  }
}

export async function fetchStickers(
  { stickerSetShortName, stickerSetId, accessHash }:
  { stickerSetShortName?: string; stickerSetId?: string; accessHash: string },
) {
  const result = await invokeRequest(new GramJs.messages.GetStickerSet({
    stickerset: stickerSetId
      ? buildInputStickerSet(stickerSetId, accessHash)
      : buildInputStickerSetShortName(stickerSetShortName!),
  }));

  if (!result) {
    return undefined;
  }

  return {
    set: buildStickerSet(result.set),
    stickers: processStickerResult(result.documents),
    packs: processStickerPackResult(result.packs),
  };
}

export async function fetchAnimatedEmojis() {
  const result = await invokeRequest(new GramJs.messages.GetStickerSet({
    stickerset: new GramJs.InputStickerSetAnimatedEmoji(),
  }));

  if (!result) {
    return undefined;
  }

  return {
    set: buildStickerSet(result.set),
    stickers: processStickerResult(result.documents),
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

export async function installStickerSet({ stickerSetId, accessHash }: { stickerSetId: string; accessHash: string }) {
  const result = await invokeRequest(new GramJs.messages.InstallStickerSet({
    stickerset: buildInputStickerSet(stickerSetId, accessHash),
  }));

  if (result) {
    onUpdate({
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
    onUpdate({
      '@type': 'updateStickerSet',
      id: stickerSetId,
      stickerSet: { installedDate: undefined },
    });
  }
}

let inputGifBot: GramJs.InputUser | undefined;

export async function searchGifs({ query, offset = '' }: { query: string; offset?: string }) {
  if (!inputGifBot) {
    const config = await invokeRequest(new GramJs.help.GetConfig());
    if (!config) {
      return undefined;
    }

    const resolvedPeer = await invokeRequest(new GramJs.contacts.ResolveUsername({
      username: config.gifSearchUsername,
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
    .filter<GramJs.TypeDocument>(Boolean as any);

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

function processStickerResult(stickers: GramJs.TypeDocument[]) {
  return stickers
    .map((document) => {
      if (document instanceof GramJs.Document) {
        const sticker = buildStickerFromDocument(document);
        if (sticker) {
          localDb.documents[String(document.id)] = document;

          return sticker;
        }
      }

      return undefined;
    })
    .filter<ApiSticker>(Boolean as any);
}

function processStickerPackResult(packs: GramJs.StickerPack[]) {
  return packs.reduce((acc, { emoticon, documents }) => {
    acc[emoticon] = documents.map((documentId) => buildStickerFromDocument(
      localDb.documents[String(documentId)],
    )).filter<ApiSticker>(Boolean as any);
    return acc;
  }, {} as Record<string, ApiSticker[]>);
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
    .filter<ApiVideo>(Boolean as any);
}
