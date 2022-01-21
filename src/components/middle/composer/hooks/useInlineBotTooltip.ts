import { useCallback, useEffect } from '../../../../lib/teact/teact';
import { getDispatch } from '../../../../lib/teact/teactn';
import { InlineBotSettings } from '../../../../types';
import useFlag from '../../../../hooks/useFlag';
import usePrevious from '../../../../hooks/usePrevious';
import useDebouncedMemo from '../../../../hooks/useDebouncedMemo';

const DEBOUNCE_MS = 300;
const INLINE_BOT_QUERY_REGEXP = /^@([a-z0-9_]{1,32})[\u00A0\u0020]+(.*)/i;
const HAS_NEW_LINE = /^@([a-z0-9_]{1,32})[\u00A0\u0020]+\n{2,}/i;

const tempEl = document.createElement('div');

export default function useInlineBotTooltip(
  isAllowed: boolean,
  chatId: string,
  html: string,
  inlineBots?: Record<string, false | InlineBotSettings>,
) {
  const { queryInlineBot, resetInlineBot } = getDispatch();

  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag();
  const {
    username, query, canShowHelp, usernameLowered,
  } = useDebouncedMemo(() => parseBotQuery(html), DEBOUNCE_MS, [html]) || {};
  const prevQuery = usePrevious(query);
  const prevUsername = usePrevious(username);
  const inlineBotData = usernameLowered ? inlineBots?.[usernameLowered] : undefined;
  const {
    id: botId,
    switchPm,
    offset,
    results,
    isGallery,
    help,
  } = inlineBotData || {};

  useEffect(() => {
    if (prevQuery !== query) {
      unmarkIsOpen();
    }
  }, [prevQuery, query, unmarkIsOpen]);

  useEffect(() => {
    if (isAllowed && usernameLowered && chatId) {
      queryInlineBot({ chatId, username: usernameLowered, query });
    }
  }, [query, isAllowed, queryInlineBot, chatId, usernameLowered]);

  const loadMore = useCallback(() => {
    queryInlineBot({
      chatId, username: usernameLowered, query, offset,
    });
  }, [offset, chatId, query, queryInlineBot, usernameLowered]);

  useEffect(() => {
    if (isAllowed && botId && (switchPm || (results?.length))) {
      markIsOpen();
    } else {
      unmarkIsOpen();
    }
  }, [botId, isAllowed, markIsOpen, results, switchPm, unmarkIsOpen]);

  if (prevUsername !== username) {
    resetInlineBot({ username: prevUsername });
  }

  return {
    isOpen,
    id: botId,
    isGallery,
    switchPm,
    results,
    closeTooltip: unmarkIsOpen,
    help: canShowHelp && help ? `@${username} ${help}` : undefined,
    loadMore,
  };
}

function parseBotQuery(html: string) {
  const text = getPlainText(html);
  const result = text.match(INLINE_BOT_QUERY_REGEXP);
  if (!result) {
    return {
      username: '',
      query: '',
      canShowHelp: false,
      usernameLowered: '',
    };
  }

  return {
    username: result[1],
    query: result[2],
    canShowHelp: result[2] === '' && !text.match(HAS_NEW_LINE),
    usernameLowered: result[1].toLowerCase(),
  };
}

function getPlainText(html: string) {
  tempEl.innerHTML = html.replace(/<br>/g, '\n');

  return tempEl.innerText;
}
