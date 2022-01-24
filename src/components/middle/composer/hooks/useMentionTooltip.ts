import {
  useCallback, useEffect, useState,
} from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../lib/teact/teactn';

import { ApiMessageEntityTypes, ApiChatMember, ApiUser } from '../../../../api/types';
import { EDITABLE_INPUT_ID } from '../../../../config';
import { filterUsersByName, getUserFirstOrLastName } from '../../../../modules/helpers';
import { prepareForRegExp } from '../helpers/prepareForRegExp';
import focusEditableElement from '../../../../util/focusEditableElement';
import useFlag from '../../../../hooks/useFlag';
import { pickTruthy, unique } from '../../../../util/iteratees';
import { throttle } from '../../../../util/schedulers';

const runThrottled = throttle((cb) => cb(), 500, true);
let RE_USERNAME_SEARCH: RegExp;

try {
  RE_USERNAME_SEARCH = new RegExp('(^|\\s)@[-_\\p{L}\\p{M}\\p{N}]*$', 'gui');
} catch (e) {
  // Support for older versions of firefox
  RE_USERNAME_SEARCH = new RegExp('(^|\\s)@[-_\\d\\wа-яё]*$', 'gi');
}

export default function useMentionTooltip(
  canSuggestMembers: boolean | undefined,
  htmlRef: { current: string },
  onUpdateHtml: (html: string) => void,
  inputId: string = EDITABLE_INPUT_ID,
  groupChatMembers?: ApiChatMember[],
  topInlineBotIds?: string[],
  currentUserId?: string,
) {
  const [isOpen, markIsOpen, unmarkIsOpen] = useFlag();
  const [usersToMention, setUsersToMention] = useState<ApiUser[] | undefined>();

  const updateFilteredUsers = useCallback((filter, withInlineBots: boolean) => {
    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;

    if (!(groupChatMembers || topInlineBotIds) || !usersById) {
      setUsersToMention(undefined);

      return;
    }

    runThrottled(() => {
      const memberIds = groupChatMembers?.reduce((acc: string[], member) => {
        if (member.userId !== currentUserId) {
          acc.push(member.userId);
        }

        return acc;
      }, []);

      const filteredIds = filterUsersByName(unique([
        ...((withInlineBots && topInlineBotIds) || []),
        ...(memberIds || []),
      ]), usersById, filter);

      setUsersToMention(Object.values(pickTruthy(usersById, filteredIds)));
    });
  }, [currentUserId, groupChatMembers, topInlineBotIds]);

  const html = htmlRef.current;
  useEffect(() => {
    if (!canSuggestMembers || !html.length) {
      unmarkIsOpen();
      return;
    }

    const usernameFilter = html.includes('@') && getUsernameFilter(html);

    if (usernameFilter) {
      const filter = usernameFilter ? usernameFilter.substr(1) : '';
      updateFilteredUsers(filter, canSuggestInlineBots(html));
    } else {
      unmarkIsOpen();
    }
  }, [canSuggestMembers, updateFilteredUsers, markIsOpen, unmarkIsOpen, html]);

  useEffect(() => {
    if (usersToMention?.length) {
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

    const currentHtml = htmlRef.current;
    const atIndex = currentHtml.lastIndexOf('@');
    if (atIndex !== -1) {
      onUpdateHtml(`${currentHtml.substr(0, atIndex)}${insertedHtml}&nbsp;`);
      const messageInput = document.getElementById(inputId)!;
      requestAnimationFrame(() => {
        focusEditableElement(messageInput, forceFocus);
      });
    }

    unmarkIsOpen();
  }, [htmlRef, inputId, onUpdateHtml, unmarkIsOpen]);

  return {
    isMentionTooltipOpen: isOpen,
    closeMentionTooltip: unmarkIsOpen,
    insertMention,
    mentionFilteredUsers: usersToMention,
  };
}

function getUsernameFilter(html: string) {
  const username = prepareForRegExp(html).match(RE_USERNAME_SEARCH);

  return username ? username[0].trim() : undefined;
}

function canSuggestInlineBots(html: string) {
  return html.startsWith('@');
}
