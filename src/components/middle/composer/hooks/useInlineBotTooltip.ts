import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { InlineBotSettings } from '../../../../types';

import memoized from '../../../../util/memoized';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedState from '../../../../hooks/useDerivedState';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';
import useSyncEffect from '../../../../hooks/useSyncEffect';

const THROTTLE = 300;
const INLINE_BOT_QUERY_REGEXP = /^@([a-z0-9_]{1,32})[\u00A0\u0020]+(.*)/is;
const HAS_NEW_LINE = /^@([a-z0-9_]{1,32})[\u00A0\u0020]+\n{2,}/i;
const MEMO_NO_RESULT = {
  username: '',
  query: '',
  canShowHelp: false,
  usernameLowered: '',
};

export default function useInlineBotTooltip(
  isEnabled: boolean,
  chatId: string,
  richText: string,
  inlineBots?: Record<string, false | InlineBotSettings>,
) {
  const { queryInlineBot, resetInlineBot, resetAllInlineBots } = getActions();

  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const extractBotQueryThrottled = useThrottledResolver(() => {
    return isEnabled && richText.startsWith('@') ? parseBotQuery(richText) : MEMO_NO_RESULT;
  }, [richText, isEnabled], THROTTLE);
  const {
    username, query, canShowHelp, usernameLowered,
  } = useDerivedState(extractBotQueryThrottled, [extractBotQueryThrottled, richText], true);

  useSyncEffect(([prevUsername]) => {
    if (prevUsername) {
      resetInlineBot({ username: prevUsername });
    }
  }, [username, resetInlineBot]);

  useEffect(() => {
    if (!usernameLowered) return;

    queryInlineBot({
      chatId, username: usernameLowered, query,
    });
  }, [chatId, query, queryInlineBot, usernameLowered]);

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, richText]);

  const {
    id: botId,
    switchPm,
    switchWebview,
    offset,
    results,
    isGallery,
    help,
  } = (usernameLowered && inlineBots?.[usernameLowered]) || {};

  const isOpen = Boolean((results?.length || switchPm || switchWebview) && !isManuallyClosed);

  useEffect(() => {
    if (!isOpen && !username) {
      resetAllInlineBots();
    }
  }, [isOpen, resetAllInlineBots, username]);

  const loadMore = useLastCallback(() => {
    if (!usernameLowered) return;

    queryInlineBot({
      chatId, username: usernameLowered, query, offset,
    });
  });

  return {
    isOpen,
    botId,
    isGallery,
    switchPm,
    switchWebview,
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

function parseBotQuery(text: string) {
  if (!text.startsWith('@')) {
    return MEMO_NO_RESULT;
  }

  const result = text.match(INLINE_BOT_QUERY_REGEXP);
  if (!result) {
    return MEMO_NO_RESULT;
  }

  return buildQueryStateMemo(result[1], result[2], result[2] === '' && !text.match(HAS_NEW_LINE));
}
