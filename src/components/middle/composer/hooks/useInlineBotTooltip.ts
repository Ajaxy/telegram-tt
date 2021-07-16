import { useCallback, useEffect, useState } from '../../../../lib/teact/teact';
import { getDispatch } from '../../../../lib/teact/teactn';
import { InlineBotSettings } from '../../../../types';
import useFlag from '../../../../hooks/useFlag';
import usePrevious from '../../../../hooks/usePrevious';

const tempEl = document.createElement('div');
const INLINE_BOT_QUERY_REGEXP = /^@([a-z0-9_]{1,32})[\u00A0\u0020]+(.*)/i;
const HAS_NEW_LINE = /^@([a-z0-9_]{1,32})[\u00A0\u0020]+\n{2,}/i;

export default function useInlineBotTooltip(
  isAllowed: boolean,
  chatId: number,
  html: string,
  inlineBots?: Record<string, false | InlineBotSettings>,
) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag();
  const [botSettings, setBotSettings] = useState<undefined | false | InlineBotSettings>();
  const text = getPlainText(html);
  const { queryInlineBot, resetInlineBot } = getDispatch();
  const { username, query, canShowHelp } = parseStartWithUsernameString(text);
  const usernameLowered = username.toLowerCase();
  const prevUsername = usePrevious(username);

  useEffect(() => {
    if (isAllowed && usernameLowered && chatId) {
      queryInlineBot({ chatId, username: usernameLowered, query });
    }
  }, [query, isAllowed, queryInlineBot, chatId, usernameLowered]);

  const loadMore = useCallback(() => {
    queryInlineBot({
      chatId, username: usernameLowered, query, offset: botSettings && botSettings.offset,
    });
  }, [botSettings, chatId, query, queryInlineBot, usernameLowered]);

  const inlineBotData = inlineBots && inlineBots[usernameLowered];

  useEffect(() => {
    setBotSettings(inlineBotData);
  }, [inlineBotData]);

  useEffect(() => {
    if (
      isAllowed && botSettings && botSettings.id
      && (botSettings.switchPm || (botSettings.results && botSettings.results.length))
    ) {
      markIsOpen();
    } else {
      unmarkIsOpen();
    }
  }, [botSettings, isAllowed, markIsOpen, unmarkIsOpen]);

  if (prevUsername !== username) {
    resetInlineBot({ username: prevUsername });
  }

  return {
    isOpen,
    closeTooltip: unmarkIsOpen,
    loadMore,
    username,
    id: botSettings ? botSettings.id : undefined,
    isGallery: botSettings ? botSettings.isGallery : undefined,
    switchPm: botSettings ? botSettings.switchPm : undefined,
    results: botSettings ? botSettings.results : undefined,
    help: canShowHelp && botSettings && botSettings.help ? `@${username} ${botSettings.help}` : undefined,
  };
}

function getPlainText(html: string) {
  tempEl.innerHTML = html.replace(/<br>/g, '\n');

  return tempEl.innerText;
}

function parseStartWithUsernameString(text: string) {
  const result = text.match(INLINE_BOT_QUERY_REGEXP);
  if (!result) {
    return { username: '', query: '', canShowHelp: false };
  }

  return {
    username: result[1],
    query: result[2],
    canShowHelp: result[2] === '' && !text.match(HAS_NEW_LINE),
  };
}
