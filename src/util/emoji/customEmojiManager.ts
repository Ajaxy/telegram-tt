import { addCallback } from '../../lib/teact/teactn';
import { getGlobal } from '../../global';

import type { ApiSticker } from '../../api/types';
import type { GlobalState } from '../../global/types';
import { ApiMediaFormat } from '../../api/types';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { getStickerPreviewHash } from '../../global/helpers';
import { selectCanPlayAnimatedEmojis } from '../../global/selectors';
import { createCallbackManager } from '../callbacks';
import generateUniqueId from '../generateUniqueId';
import * as mediaLoader from '../mediaLoader';
import { throttle } from '../schedulers';
import { IS_WEBM_SUPPORTED } from '../windowEnvironment';

import blankSrc from '../../assets/blank.png';
import placeholderSrc from '../../assets/square.svg';

type CustomEmojiLoadCallback = (customEmojis: GlobalState['customEmojis']) => void;
type CustomEmojiInputRenderCallback = (emojiId: string) => void;

const DOM_PROCESS_THROTTLE = 500;

const INPUT_WAITING_CUSTOM_EMOJI_IDS: Set<string> = new Set();

const handlers = new Map<CustomEmojiLoadCallback, string>();
const renderCallbacks = createCallbackManager<CustomEmojiInputRenderCallback>();

let prevGlobal: GlobalState | undefined;

addCallback((global: GlobalState) => {
  if (
    global.customEmojis.byId !== prevGlobal?.customEmojis.byId
    || selectCanPlayAnimatedEmojis(global) !== selectCanPlayAnimatedEmojis(prevGlobal)
  ) {
    for (const entry of handlers) {
      const [handler, id] = entry;
      if (global.customEmojis.byId[id]) {
        handler(global.customEmojis);
      }
    }

    checkInputCustomEmojiLoad(global.customEmojis);
  }

  prevGlobal = global;
});

export function addCustomEmojiCallback(handler: CustomEmojiLoadCallback, emojiId: string) {
  handlers.set(handler, emojiId);
}

export function removeCustomEmojiCallback(handler: CustomEmojiLoadCallback) {
  handlers.delete(handler);
}

export const addCustomEmojiInputRenderCallback = renderCallbacks.addCallback;
const callInputRenderHandlers = throttle(renderCallbacks.runCallbacks, DOM_PROCESS_THROTTLE);

function processDomForCustomEmoji() {
  const emojis = document.querySelectorAll<HTMLImageElement>('.custom-emoji.placeholder');
  emojis.forEach((emoji) => {
    const customEmoji = getGlobal().customEmojis.byId[emoji.dataset.documentId!];
    if (!customEmoji) {
      INPUT_WAITING_CUSTOM_EMOJI_IDS.add(emoji.dataset.documentId!);
      return;
    }
    const [isPlaceholder, src, uniqueId] = getInputCustomEmojiParams(customEmoji);

    if (customEmoji.shouldUseTextColor && !emoji.classList.contains('colorable')) {
      requestMutation(() => {
        emoji.classList.add('colorable');
      });
    }

    if (!isPlaceholder) {
      requestMutation(() => {
        emoji.src = src;
        emoji.classList.remove('placeholder');
        if (uniqueId) emoji.dataset.uniqueId = uniqueId;

        callInputRenderHandlers(customEmoji.id);
      });
    }
  });
}

export const processMessageInputForCustomEmoji = throttle(processDomForCustomEmoji, DOM_PROCESS_THROTTLE);

function checkInputCustomEmojiLoad(customEmojis: GlobalState['customEmojis']) {
  const loaded = Array.from(INPUT_WAITING_CUSTOM_EMOJI_IDS).filter((id) => Boolean(customEmojis.byId[id]));
  if (loaded.length) {
    loaded.forEach((id) => INPUT_WAITING_CUSTOM_EMOJI_IDS.delete(id));
    processMessageInputForCustomEmoji();
  }
}

export function getCustomEmojiMediaDataForInput(emojiId: string, isPreview?: boolean) {
  const mediaHash = isPreview ? getStickerPreviewHash(emojiId) : `sticker${emojiId}`;
  const data = mediaLoader.getFromMemory(mediaHash);
  if (data) {
    return data;
  }

  fetchAndProcess(mediaHash);
  return undefined;
}

function fetchAndProcess(mediaHash: string) {
  return mediaLoader.fetch(mediaHash, ApiMediaFormat.BlobUrl).then(() => {
    processMessageInputForCustomEmoji();
  });
}

export function getInputCustomEmojiParams(customEmoji?: ApiSticker) {
  if (!customEmoji) return [true, placeholderSrc, undefined];
  const shouldUseStaticFallback = !IS_WEBM_SUPPORTED && customEmoji.isVideo;
  const isUsingSharedCanvas = customEmoji.isLottie || (customEmoji.isVideo && !shouldUseStaticFallback);
  if (isUsingSharedCanvas) {
    fetchAndProcess(`sticker${customEmoji.id}`);
    return [false, blankSrc, generateUniqueId()];
  }

  const mediaData = getCustomEmojiMediaDataForInput(customEmoji.id, shouldUseStaticFallback);

  return [!mediaData, mediaData || placeholderSrc, undefined];
}
