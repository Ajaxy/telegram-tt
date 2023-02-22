import { useEffect, useState } from '../../../../lib/teact/teact';

import type { ApiBotCommand } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';

import { prepareForRegExp } from '../helpers/prepareForRegExp';
import useFlag from '../../../../hooks/useFlag';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';

const RE_COMMAND = /^\/([\w@]{1,32})?$/i;

const THROTTLE = 300;

export default function useBotCommandTooltip(
  isEnabled: boolean,
  getHtml: Signal<string>,
  botCommands?: ApiBotCommand[] | false,
  chatBotCommands?: ApiBotCommand[],
) {
  const [filteredBotCommands, setFilteredBotCommands] = useState<ApiBotCommand[] | undefined>();
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
    if (!command || !commands) {
      setFilteredBotCommands(undefined);
      return;
    }

    const filter = command.substring(1);
    const nextFilteredBotCommands = commands.filter((c) => !filter || c.command.includes(filter));

    setFilteredBotCommands(
      nextFilteredBotCommands?.length ? nextFilteredBotCommands : undefined,
    );
  }, [getCommand, botCommands, chatBotCommands]);

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, getHtml]);

  return {
    isOpen: Boolean(filteredBotCommands?.length && !isManuallyClosed),
    close: markManuallyClosed,
    filteredBotCommands,
  };
}
