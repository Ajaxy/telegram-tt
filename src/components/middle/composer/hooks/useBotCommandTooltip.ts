import {
  useCallback, useEffect, useState,
} from '../../../../lib/teact/teact';

import { ApiBotCommand } from '../../../../api/types';

import { prepareForRegExp } from '../helpers/prepareForRegExp';
import { throttle } from '../../../../util/schedulers';
import useFlag from '../../../../hooks/useFlag';

const runThrottled = throttle((cb) => cb(), 500, true);
const RE_COMMAND = /^[\w@]{1,32}\s?/i;

export default function useBotCommandTooltip(
  isAllowed: boolean,
  html: string,
  botCommands?: ApiBotCommand[] | false,
  chatBotCommands?: ApiBotCommand[],
) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag();
  const [filteredBotCommands, setFilteredBotCommands] = useState<ApiBotCommand[] | undefined>();

  const getFilteredCommands = useCallback((filter) => {
    if (!botCommands && !chatBotCommands) {
      setFilteredBotCommands(undefined);

      return;
    }

    runThrottled(() => {
      const nextFilteredBotCommands = (botCommands || chatBotCommands || [])
        .filter(({ command }) => !filter || command.includes(filter));
      setFilteredBotCommands(
        nextFilteredBotCommands && nextFilteredBotCommands.length ? nextFilteredBotCommands : undefined,
      );
    });
  }, [botCommands, chatBotCommands]);

  useEffect(() => {
    if (!isAllowed || !html.length) {
      unmarkIsOpen();
      return;
    }

    const shouldShowCommands = html.startsWith('/');

    if (shouldShowCommands) {
      const filter = prepareForRegExp(html.substr(1)).match(RE_COMMAND);
      getFilteredCommands(filter ? filter[0] : '');
    } else {
      unmarkIsOpen();
    }
  }, [getFilteredCommands, html, isAllowed, unmarkIsOpen]);

  useEffect(() => {
    if (filteredBotCommands && filteredBotCommands.length) {
      markIsOpen();
    } else {
      unmarkIsOpen();
    }
  }, [filteredBotCommands, markIsOpen, unmarkIsOpen]);

  return {
    isOpen,
    close: unmarkIsOpen,
    filteredBotCommands,
  };
}
