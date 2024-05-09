import { getActions, getGlobal } from '../global';

import { addCustomEmojiInputRenderCallback } from '../util/emoji/customEmojiManager';
import { throttle } from '../util/schedulers';

let LOAD_QUEUE = new Set<string>();
const RENDER_HISTORY = new Set<string>();
const THROTTLE = 200;
const LIMIT_PER_REQUEST = 100;

const loadFromQueue = throttle(() => {
  const queue = [...LOAD_QUEUE];

  const queueToLoad = queue.slice(0, LIMIT_PER_REQUEST);
  const otherQueue = queue.slice(LIMIT_PER_REQUEST + 1);

  getActions().loadCustomEmojis({
    ids: queueToLoad,
  });

  LOAD_QUEUE = new Set(otherQueue);

  // Schedule next load
  if (LOAD_QUEUE.size) {
    loadFromQueue();
  }
}, THROTTLE, false);

const updateLastRendered = throttle(() => {
  getActions().updateLastRenderedCustomEmojis({
    ids: [...RENDER_HISTORY].reverse(),
  });

  RENDER_HISTORY.clear();
}, THROTTLE, false);

function notifyCustomEmojiRender(emojiId: string) {
  RENDER_HISTORY.add(emojiId);
  updateLastRendered();
}

addCustomEmojiInputRenderCallback(notifyCustomEmojiRender);

export default function useEnsureCustomEmoji(id?: string) {
  if (!id) return;
  notifyCustomEmojiRender(id);

  if (getGlobal().customEmojis.byId[id]) {
    return;
  }

  LOAD_QUEUE.add(id);
  loadFromQueue();
}
