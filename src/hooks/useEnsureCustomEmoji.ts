import { getActions, getGlobal } from '../global';
import { throttle } from '../util/schedulers';

const LOAD_QUEUE = new Set<string>();
const RENDER_HISTORY = new Set<string>();
const THROTTLE = 200;

const loadFromQueue = throttle(() => {
  getActions().loadCustomEmojis({
    ids: [...LOAD_QUEUE],
  });

  LOAD_QUEUE.clear();
}, THROTTLE, false);

const updateLastRendered = throttle(() => {
  getActions().updateLastRenderedCustomEmojis({
    ids: [...RENDER_HISTORY].reverse(),
  });

  RENDER_HISTORY.clear();
}, THROTTLE, false);

export default function useEnsureCustomEmoji(id: string) {
  RENDER_HISTORY.add(id);
  updateLastRendered();

  if (getGlobal().customEmojis.byId[id]) {
    return;
  }
  LOAD_QUEUE.add(id);
  loadFromQueue();
}
