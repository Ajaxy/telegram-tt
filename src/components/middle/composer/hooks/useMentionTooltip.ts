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

const runThrottled = throttle((cb) => cb(), 500, true);
const RE_BR = /(<br>|<br\s?\/>)/g;
const RE_SPACE = /&nbsp;/g;
const RE_CLEAN_HTML = /(<div>|<\/div>)/gi;
const RE_USERNAME_SEARCH = new RegExp('(^|\\s)@[\\w\\d_-]*$', 'gi');

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
  const username = html
    .replace(RE_SPACE, ' ')
    .replace(RE_BR, '\n')
    .replace(RE_CLEAN_HTML, '')
    .replace(/\n$/i, '')
    .match(RE_USERNAME_SEARCH);

  return username ? username[0].trim() : undefined;
}

function canSuggestInlineBots(html: string) {
  return html.startsWith('@');
}
