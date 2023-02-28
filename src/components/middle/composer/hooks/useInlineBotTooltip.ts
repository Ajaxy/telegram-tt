import { useCallback, useEffect } from '../../../../lib/teact/teact';

import type { InlineBotSettings } from '../../../../types';
import type { Signal } from '../../../../util/signals';

import { getActions } from '../../../../global';
import memoized from '../../../../util/memoized';

import useFlag from '../../../../hooks/useFlag';
import useDerivedState from '../../../../hooks/useDerivedState';
import useSyncEffect from '../../../../hooks/useSyncEffect';
import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';

const THROTTLE = 300;
const INLINE_BOT_QUERY_REGEXP = /^@([a-z0-9_]{1,32})[\u00A0\u0020]+(.*)/i;
const HAS_NEW_LINE = /^@([a-z0-9_]{1,32})[\u00A0\u0020]+\n{2,}/i;
const MEMO_NO_RESULT = {
  username: '',
  query: '',
  canShowHelp: false,
  usernameLowered: '',
};

const tempEl = document.createElement('div');

export default function useInlineBotTooltip(
  isEnabled: boolean,
  chatId: string,
  getHtml: Signal<string>,
  inlineBots?: Record<string, false | InlineBotSettings>,
) {
  const { queryInlineBot, resetInlineBot, resetAllInlineBots } = getActions();

  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const extractBotQueryThrottled = useThrottledResolver(() => {
    const html = getHtml();
    return isEnabled && html.startsWith('@') ? parseBotQuery(html) : MEMO_NO_RESULT;
  }, [getHtml, isEnabled], THROTTLE);
  const {
    username, query, canShowHelp, usernameLowered,
  } = useDerivedState(extractBotQueryThrottled, [extractBotQueryThrottled, getHtml], true);

  useSyncEffect(([prevUsername]) => {
    if (prevUsername) {
      resetInlineBot({ username: prevUsername });
    }
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [username, resetInlineBot] as const);

  useEffect(() => {
    if (!usernameLowered) return;

    queryInlineBot({
      chatId, username: usernameLowered, query,
    });
  }, [chatId, query, queryInlineBot, usernameLowered]);

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, getHtml]);

  const {
    id: botId,
    switchPm,
    offset,
    results,
    isGallery,
    help,
  } = (usernameLowered && inlineBots?.[usernameLowered]) || {};

  const isOpen = Boolean((results?.length || switchPm) && !isManuallyClosed);

  useEffect(() => {
    if (!isOpen && !username) {
      resetAllInlineBots();
    }
  }, [isOpen, resetAllInlineBots, username]);

  const loadMore = useCallback(() => {
    if (!usernameLowered) return;

    queryInlineBot({
      chatId, username: usernameLowered, query, offset,
    });
  }, [chatId, offset, query, queryInlineBot, usernameLowered]);

  return {
    isOpen,
    botId,
    isGallery,
    switchPm,
    results,
    closeTooltip: markManuallyClosed,
    help: canShowHelp && help ? `@${username} ${help}` : undefined,
    loadMore,
  };
}

const buildQueryStateMemo = memoized((username: string, query: string, canShowHelp: boolean) => ({
  username,
  query,
  canShowHelp,
  usernameLowered: username.toLowerCase(),
}));

function parseBotQuery(html: string) {
  if (!html.startsWith('@')) {
    return MEMO_NO_RESULT;
  }

  const text = getPlainText(html);
  const result = text.match(INLINE_BOT_QUERY_REGEXP);
  if (!result) {
    return MEMO_NO_RESULT;
  }

  return buildQueryStateMemo(result[1], result[2], result[2] === '' && !text.match(HAS_NEW_LINE));
}

function getPlainText(html: string) {
  tempEl.innerHTML = html.replace(/<br>/g, '\n');

  tempEl.querySelectorAll<HTMLElement>('[alt]').forEach((el) => {
    if (!el.innerText) {
      el.innerText = el.getAttribute('alt')!;
    }
  });

  return tempEl.innerText;
}
