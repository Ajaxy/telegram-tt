import { useEffect, useState } from '../../../../lib/teact/teact';

import type { ApiBotCommand, ApiQuickReply } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';

import { prepareForRegExp } from '../helpers/prepareForRegExp';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useFlag from '../../../../hooks/useFlag';

const RE_COMMAND = /^\/([\w@]{1,32})?$/i;

const THROTTLE = 300;

export default function useChatCommandTooltip(
  isEnabled: boolean,
  getHtml: Signal<string>,
  botCommands?: ApiBotCommand[] | false,
  chatBotCommands?: ApiBotCommand[],
  quickReplies?: Record<number, ApiQuickReply>,
) {
  const [filteredBotCommands, setFilteredBotCommands] = useState<ApiBotCommand[] | undefined>();
  const [filteredQuickReplies, setFilteredQuickReplies] = useState<ApiQuickReply[] | undefined>();
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const detectCommandThrottled = useThrottledResolver(() => {
    const html = getHtml();
    return isEnabled && html.startsWith('/') ? prepareForRegExp(html).match(RE_COMMAND)?.[0].trim() : undefined;
  }, [getHtml, isEnabled], THROTTLE);

  const getCommand = useDerivedSignal(
    detectCommandThrottled, [detectCommandThrottled, getHtml], true,
  );

  useEffect(() => {
    const command = getCommand();
    const commands = botCommands || chatBotCommands;
    if (!command || (!commands && !quickReplies)) {
      setFilteredBotCommands(undefined);
      setFilteredQuickReplies(undefined);
      return;
    }

    const filter = command.substring(1);
    const nextFilteredBotCommands = commands?.filter((c) => !filter || c.command.startsWith(filter));

    setFilteredBotCommands(
      nextFilteredBotCommands?.length ? nextFilteredBotCommands : undefined,
    );

    const newFilteredQuickReplies = Object.values(quickReplies || {}).filter((quickReply) => (
      !filter || quickReply.shortcut.startsWith(filter)
    ));

    setFilteredQuickReplies(
      newFilteredQuickReplies?.length ? newFilteredQuickReplies : undefined,
    );
  }, [getCommand, botCommands, chatBotCommands, quickReplies]);

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, getHtml]);

  return {
    isOpen: Boolean((filteredBotCommands?.length || filteredQuickReplies?.length) && !isManuallyClosed),
    close: markManuallyClosed,
    filteredBotCommands,
    filteredQuickReplies,
  };
}
