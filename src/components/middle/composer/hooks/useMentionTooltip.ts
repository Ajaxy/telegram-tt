import { useCallback, useEffect, useState } from '../../../../lib/teact/teact';

import { ApiMessageEntityTypes, ApiChatMember, ApiUser } from '../../../../api/types';
import { EDITABLE_INPUT_ID } from '../../../../config';
import { getUserFirstOrLastName } from '../../../../modules/helpers';
import searchUserName from '../helpers/searchUserName';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../../util/environment';
import focusEditableElement from '../../../../util/focusEditableElement';
import useFlag from '../../../../hooks/useFlag';

const RE_NOT_USERNAME_SEARCH = /[^@_\d\wа-яё]+/i;

export default function useMentionTooltip(
  canSuggestMembers: boolean | undefined,
  html: string,
  onUpdateHtml: (html: string) => void,
  inputId: string = EDITABLE_INPUT_ID,
  groupChatMembers?: ApiChatMember[],
  currentUserId?: number,
  usersById?: Record<number, ApiUser>,
) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag();
  const [currentFilter, setCurrentFilter] = useState('');
  const [filteredMembers, setFilteredMembers] = useState<ApiChatMember[]>([]);

  const getFilteredMembers = useCallback((filter) => {
    if (!groupChatMembers || !usersById) {
      return undefined;
    }

    return groupChatMembers.filter(({ userId }) => {
      const user = usersById[userId];
      if (userId === currentUserId || !user) {
        return false;
      }

      return !filter || searchUserName(filter, user);
    });
  }, [groupChatMembers, currentUserId, usersById]);

  useEffect(() => {
    if (!canSuggestMembers || !html.length) {
      unmarkIsOpen();
      return;
    }

    const usernameFilter = getUsernameFilter(html);

    if (usernameFilter) {
      const filter = usernameFilter ? usernameFilter.substr(1) : '';
      const membersToMention = getFilteredMembers(filter);
      if (membersToMention && membersToMention.length) {
        markIsOpen();
        setCurrentFilter(filter);
        setFilteredMembers(membersToMention);
      } else {
        unmarkIsOpen();
      }
    } else {
      unmarkIsOpen();
    }
  }, [canSuggestMembers, html, getFilteredMembers, markIsOpen, unmarkIsOpen]);

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
      if (!IS_SINGLE_COLUMN_LAYOUT) {
        requestAnimationFrame(() => {
          focusEditableElement(messageInput, forceFocus);
        });
      }
    }

    unmarkIsOpen();
  }, [html, inputId, onUpdateHtml, unmarkIsOpen]);

  return {
    isMentionTooltipOpen: isOpen,
    mentionFilter: currentFilter,
    closeMentionTooltip: unmarkIsOpen,
    insertMention,
    mentionFilteredMembers: filteredMembers,
  };
}

function getUsernameFilter(html: string) {
  const tempEl = document.createElement('div');
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
