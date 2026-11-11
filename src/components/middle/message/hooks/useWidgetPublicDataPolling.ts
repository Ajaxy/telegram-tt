import { useEffect } from '../../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../../global';

import type { GlobalState } from '../../../../global/types';

import { selectChat, selectChatMessage } from '../../../../global/selectors';
import { callApi } from '../../../../api/gramjs';

type Carrier = {
  chatId: string;
  messageId: number;
  isWatching: boolean;
};

type Poller = {
  carriers: Set<Carrier>;
  nextPollAt: number;
  period: number;
  isLoading?: boolean;
  // While a poll runs: the hash each carrier had when the poll started or when it joined
  hashes?: Map<Carrier, string | undefined>;
  timeout?: number;
};

// The server's cadence, 5–3600 s; 30 s also before the first answer and after a failure
const DEFAULT_PERIOD = 30;
const MIN_PERIOD = 5;
const MAX_PERIOD = 3600;
const MS_IN_SECOND = 1000;

// shortcut: entries stay for the session to keep `nextPollAt` across scrolling, a session sees few shared widgets
const pollers = new Map<string, Poller>();

export default function useWidgetPublicDataPolling({
  widgetId, chatId, messageId, isVisible, isWatching,
}: {
  widgetId?: string;
  chatId: string;
  messageId: number;
  isVisible: boolean;
  isWatching: boolean;
}) {
  useEffect(() => {
    if (!widgetId || !isVisible) return undefined;

    let poller = pollers.get(widgetId);
    if (!poller) {
      // The message brought the current shared state, so the first poll waits a period too
      poller = { carriers: new Set(), nextPollAt: Date.now() + DEFAULT_PERIOD * MS_IN_SECOND, period: DEFAULT_PERIOD };
      pollers.set(widgetId, poller);
    }
    const currentPoller = poller;
    const carrier = { chatId, messageId, isWatching };
    currentPoller.carriers.add(carrier);
    currentPoller.hashes?.set(carrier, selectCarrierHash(getGlobal(), carrier));
    schedulePoll(currentPoller);

    return () => {
      currentPoller.carriers.delete(carrier);
      schedulePoll(currentPoller);
    };
  }, [widgetId, chatId, messageId, isVisible, isWatching]);
}

function schedulePoll(poller: Poller) {
  clearTimeout(poller.timeout);
  poller.timeout = undefined;
  if (poller.isLoading || !findWatchingCarrier(poller)) return;

  poller.timeout = window.setTimeout(() => pollPublicData(poller), Math.max(0, poller.nextPollAt - Date.now()));
}

async function pollPublicData(poller: Poller) {
  const { chatId, messageId } = findWatchingCarrier(poller)!;
  const global = getGlobal();
  const chat = selectChat(global, chatId);
  const polled = selectChatMessage(global, chatId, messageId)?.content.widget;
  const hash = polled?.publicDataHash;
  const hashes = new Map(Array.from(poller.carriers, (carrier) => [carrier, selectCarrierHash(global, carrier)]));
  poller.hashes = hashes;

  poller.isLoading = true;
  const result = chat && await callApi('fetchWidgetPublicData', { chat, messageId, hash });
  poller.isLoading = false;
  poller.hashes = undefined;
  // A period out of the server's range is clamped into it
  poller.period = result ? Math.min(MAX_PERIOD, Math.max(MIN_PERIOD, result.period)) : DEFAULT_PERIOD;
  poller.nextPollAt = Date.now() + poller.period * MS_IN_SECOND;

  // A carrier that an update changed during the request keeps that newer state
  const current = getGlobal();
  const unchanged = Array.from(hashes.keys()).filter((carrier) => (
    selectCarrierHash(current, carrier) === hashes.get(carrier)
  ));

  if (result?.data !== undefined) {
    // The shared state is the object's, so every carrier on screen takes the answer of one
    getActions().setMessagesWidgetPublicData({
      messages: unchanged,
      publicData: result.data,
      publicDataHash: result.hash!,
    });
  } else if (result && hash) {
    // Not modified confirms the polled carrier's state, which the other carriers on screen may not have yet
    const stale = unchanged.filter((carrier) => hashes.get(carrier) !== hash);
    if (stale.length) {
      getActions().setMessagesWidgetPublicData({
        messages: stale,
        publicData: polled.publicData ?? '',
        publicDataHash: hash,
      });
    }
  }

  schedulePoll(poller);
}

function selectCarrierHash(global: GlobalState, { chatId, messageId }: Carrier) {
  return selectChatMessage(global, chatId, messageId)?.content.widget?.publicDataHash;
}

function findWatchingCarrier(poller: Poller) {
  return Array.from(poller.carriers).find(({ isWatching }) => isWatching);
}
