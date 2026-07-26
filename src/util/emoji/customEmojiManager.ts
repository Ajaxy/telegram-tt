import { addCallback } from '../../lib/teact/teactn';

import type { GlobalState } from '../../global/types';

import { selectCanPlayAnimatedEmojis, selectCustomEmoji } from '../../global/selectors';

type CustomEmojiLoadCallback = (customEmojis: GlobalState['customEmojis']) => void;

const handlers = new Map<CustomEmojiLoadCallback, string>();

let prevGlobal: GlobalState | undefined;

addCallback((global: GlobalState) => {
  if (
    global.customEmojis.byId !== prevGlobal?.customEmojis.byId
    || selectCanPlayAnimatedEmojis(global) !== selectCanPlayAnimatedEmojis(prevGlobal)
  ) {
    for (const entry of handlers) {
      const [handler, id] = entry;
      if (selectCustomEmoji(global, id)) {
        handler(global.customEmojis);
      }
    }
  }

  prevGlobal = global;
});

export function addCustomEmojiCallback(handler: CustomEmojiLoadCallback, emojiId: string) {
  handlers.set(handler, emojiId);
}

export function removeCustomEmojiCallback(handler: CustomEmojiLoadCallback) {
  handlers.delete(handler);
}
