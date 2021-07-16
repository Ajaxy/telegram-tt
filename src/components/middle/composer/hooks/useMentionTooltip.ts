import {
  useCallback, useEffect, useState, useMemo,
} from '../../../../lib/teact/teact';

import { ApiMessageEntityTypes, ApiChatMember, ApiUser } from '../../../../api/types';
import { EDITABLE_INPUT_ID } from '../../../../config';
import { getUserFirstOrLastName } from '../../../../modules/helpers';
import searchUserName from '../helpers/searchUserName';
import focusEditableElement from '../../../../util/focusEditableElement';
import useFlag from '../../../../hooks/useFlag';
import { unique } from '../../../../util/iteratees';
import { throttle } from '../../../../util/schedulers';

const tempEl = document.createElement('div');
const RE_NOT_USERNAME_SEARCH = /[^@_\d\wа-яё]+/i;
const runThrottled = throttle((cb) => cb(), 500, true);

export default function useMentionTooltip(
  canSuggestMembers: boolean | undefined,
  html: string,
  onUpdateHtml: (html: string) => void,
  inputId: string = EDITABLE_INPUT_ID,
  groupChatMembers?: ApiChatMember[],
  topInlineBotIds?: number[],
  currentUserId?: number,
  usersById?: Record<number, ApiUser>,
) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag();
  const [currentFilter, setCurrentFilter] = useState('');
  const [usersToMention, setUsersToMention] = useState<ApiUser[] | undefined>();

  const topInlineBots = useMemo(() => {
    return (topInlineBotIds || []).map((id) => usersById && usersById[id]).filter<ApiUser>(Boolean as any);
  }, [topInlineBotIds, usersById]);

  const getFilteredUsers = useCallback((filter, withInlineBots: boolean) => {
    if (!(groupChatMembers || topInlineBotIds) || !usersById) {
      setUsersToMention(undefined);

      return;
    }
    runThrottled(() => {
      const inlineBots = (withInlineBots ? topInlineBots : []).filter((inlineBot) => {
        return !filter || searchUserName(filter, inlineBot);
      });

      const chatMembers = (groupChatMembers || [])
        .map(({ userId }) => usersById[userId])
        .filter((user) => {
          if (!user || user.id === currentUserId) {
            return false;
          }

          return !filter || searchUserName(filter, user);
        });

      setUsersToMention(unique(inlineBots.concat(chatMembers)));
    });
  }, [currentUserId, groupChatMembers, topInlineBotIds, topInlineBots, usersById]);

  useEffect(() => {
    if (!canSuggestMembers || !html.length) {
      unmarkIsOpen();
      return;
    }

    const usernameFilter = html.includes('@') && getUsernameFilter(html);

    if (usernameFilter) {
      const filter = usernameFilter ? usernameFilter.substr(1) : '';
      setCurrentFilter(filter);
      getFilteredUsers(filter, canSuggestInlineBots(html));
    } else {
      unmarkIsOpen();
    }
  }, [canSuggestMembers, html, getFilteredUsers, markIsOpen, unmarkIsOpen]);

  useEffect(() => {
    if (usersToMention && usersToMention.length) {
      markIsOpen();
    } else {
      unmarkIsOpen();
    }
  }, [markIsOpen, unmarkIsOpen, usersToMention]);

  const insertMention = useCallback((user: ApiUser, forceFocus = false) => {
    if (!user.username && !getUserFirstOrLastName(user)) {
      return;
    }

    const insertedHtml = user.username
      ? `@${user.username}`
      : `<a
          class="text-entity-link"
          data-entity-type="${ApiMessageEntityTypes.MentionName}"
          data-user-id="${user.id}"
          contenteditable="false"
          dir="auto"
        >${getUserFirstOrLastName(user)}</a>`;

    const atIndex = html.lastIndexOf('@');
    if (atIndex !== -1) {
      onUpdateHtml(`${html.substr(0, atIndex)}${insertedHtml}&nbsp;`);
      const messageInput = document.getElementById(inputId)!;
      requestAnimationFrame(() => {
        focusEditableElement(messageInput, forceFocus);
      });
    }

    unmarkIsOpen();
  }, [html, inputId, onUpdateHtml, unmarkIsOpen]);

  return {
    isMentionTooltipOpen: isOpen,
    mentionFilter: currentFilter,
    closeMentionTooltip: unmarkIsOpen,
    insertMention,
    mentionFilteredUsers: usersToMention,
  };
}

function getUsernameFilter(html: string) {
  tempEl.innerHTML = html;
  const text = tempEl.innerText.replace(/\n$/i, '');

  const lastSymbol = text[text.length - 1];
  const lastWord = text.split(RE_NOT_USERNAME_SEARCH).pop();

  if (
    !text.length || RE_NOT_USERNAME_SEARCH.test(lastSymbol)
    || !lastWord || !lastWord.startsWith('@')
  ) {
    return undefined;
  }

  return lastWord;
}

function canSuggestInlineBots(html: string) {
  tempEl.innerHTML = html;
  const text = tempEl.innerText;

  return text.startsWith('@');
}
