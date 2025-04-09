import type { RefObject } from 'react';
import { useEffect, useState } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type { ApiChatMember, ApiUser } from '../../../../api/types';
import type { Signal } from '../../../../util/signals';
import { ApiMessageEntityTypes } from '../../../../api/types';

import { requestNextMutation } from '../../../../lib/fasterdom/fasterdom';
import { getMainUsername, getUserFirstOrLastName } from '../../../../global/helpers';
import { filterPeersByQuery } from '../../../../global/helpers/peers';
import focusEditableElement from '../../../../util/focusEditableElement';
import { pickTruthy, unique } from '../../../../util/iteratees';
import { getCaretPosition, getHtmlBeforeSelection, setCaretPosition } from '../../../../util/selection';
import { prepareForRegExp } from '../helpers/prepareForRegExp';

import { useThrottledResolver } from '../../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../../hooks/useDerivedSignal';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

const THROTTLE = 300;

let RE_USERNAME_SEARCH: RegExp;
try {
  RE_USERNAME_SEARCH = /(^|\s)@[-_\p{L}\p{M}\p{N}]*$/gui;
} catch (e) {
  // Support for older versions of Firefox
  RE_USERNAME_SEARCH = /(^|\s)@[-_\d\wа-яёґєії]*$/gi;
}

export default function useMentionTooltip(
  isEnabled: boolean,
  getHtml: Signal<string>,
  setHtml: (html: string) => void,
  getSelectionRange: Signal<Range | undefined>,
  inputRef: RefObject<HTMLDivElement>,
  groupChatMembers?: ApiChatMember[],
  topInlineBotIds?: string[],
  currentUserId?: string,
) {
  const [filteredUsers, setFilteredUsers] = useState<ApiUser[] | undefined>();
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  const extractUsernameTagThrottled = useThrottledResolver(() => {
    const html = getHtml();
    if (!isEnabled || !getSelectionRange()?.collapsed || !html.includes('@')) return undefined;

    const htmlBeforeSelection = getHtmlBeforeSelection(inputRef.current!);

    return prepareForRegExp(htmlBeforeSelection).match(RE_USERNAME_SEARCH)?.[0].trim();
  }, [isEnabled, getHtml, getSelectionRange, inputRef], THROTTLE);

  const getUsernameTag = useDerivedSignal(
    extractUsernameTagThrottled, [extractUsernameTagThrottled, getHtml, getSelectionRange], true,
  );

  const getWithInlineBots = useDerivedSignal(() => {
    return isEnabled && getHtml().startsWith('@');
  }, [getHtml, isEnabled]);

  useEffect(() => {
    const usernameTag = getUsernameTag();

    if (!usernameTag || !(groupChatMembers || topInlineBotIds)) {
      setFilteredUsers(undefined);
      return;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    if (!usersById) {
      setFilteredUsers(undefined);
      return;
    }

    const memberIds = groupChatMembers?.reduce((acc: string[], member) => {
      if (member.userId !== currentUserId) {
        acc.push(member.userId);
      }

      return acc;
    }, []);

    const filter = usernameTag.substring(1);
    const filteredIds = filterPeersByQuery({
      ids: unique([
        ...((getWithInlineBots() && topInlineBotIds) || []),
        ...(memberIds || []),
      ]),
      query: filter,
      type: 'user',
    });

    setFilteredUsers(Object.values(pickTruthy(usersById, filteredIds)));
  }, [currentUserId, groupChatMembers, topInlineBotIds, getUsernameTag, getWithInlineBots]);

  const insertMention = useLastCallback((user: ApiUser, forceFocus = false) => {
    if (!user.usernames && !getUserFirstOrLastName(user)) {
      return;
    }

    const mainUsername = getMainUsername(user);
    const userFirstOrLastName = getUserFirstOrLastName(user) || '';
    const htmlToInsert = mainUsername
      ? `@${mainUsername}`
      : `<a
          class="text-entity-link"
          data-entity-type="${ApiMessageEntityTypes.MentionName}"
          data-user-id="${user.id}"
          contenteditable="false"
          dir="auto"
        >${userFirstOrLastName}</a>`;

    const inputEl = inputRef.current!;
    const htmlBeforeSelection = getHtmlBeforeSelection(inputEl);
    const fixedHtmlBeforeSelection = cleanWebkitNewLines(htmlBeforeSelection);
    const atIndex = fixedHtmlBeforeSelection.lastIndexOf('@');
    const shiftCaretPosition = (mainUsername ? mainUsername.length + 1 : userFirstOrLastName.length)
      - (fixedHtmlBeforeSelection.length - atIndex);

    if (atIndex !== -1) {
      const newHtml = `${fixedHtmlBeforeSelection.substr(0, atIndex)}${htmlToInsert}&nbsp;`;
      const htmlAfterSelection = cleanWebkitNewLines(inputEl.innerHTML).substring(fixedHtmlBeforeSelection.length);
      const caretPosition = getCaretPosition(inputEl);
      setHtml(`${newHtml}${htmlAfterSelection}`);

      requestNextMutation(() => {
        const newCaretPosition = caretPosition + shiftCaretPosition + 1;
        focusEditableElement(inputEl, forceFocus);
        if (newCaretPosition >= 0) {
          setCaretPosition(inputEl, newCaretPosition);
        }
      });
    }

    setFilteredUsers(undefined);
  });

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, getHtml]);

  return {
    isMentionTooltipOpen: Boolean(filteredUsers?.length && !isManuallyClosed),
    closeMentionTooltip: markManuallyClosed,
    insertMention,
    mentionFilteredUsers: filteredUsers,
  };
}

// Webkit replaces the line break with the `<div><br /></div>` or `<div></div>` code.
// It is necessary to clean the html to a single form before processing.
function cleanWebkitNewLines(html: string) {
  return html.replace(/<div>(<br>|<br\s?\/>)?<\/div>/gi, '<br>');
}
