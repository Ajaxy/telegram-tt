import React, {
  FC, useCallback, useEffect, useState, useRef, memo,
} from '../../../lib/teact/teact';
import usePrevious from '../../../hooks/usePrevious';

import { ApiChatMember, ApiUser } from '../../../api/types';

import useShowTransition from '../../../hooks/useShowTransition';
import buildClassName from '../../../util/buildClassName';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import findInViewport from '../../../util/findInViewport';
import isFullyVisible from '../../../util/isFullyVisible';
import fastSmoothScroll from '../../../util/fastSmoothScroll';
import cycleRestrict from '../../../util/cycleRestrict';

import ListItem from '../../ui/ListItem';
import PrivateChatInfo from '../../common/PrivateChatInfo';

import './MentionMenu.scss';

const VIEWPORT_MARGIN = 8;
const SCROLL_MARGIN = 10;

function setItemVisible(index: number, containerRef: Record<string, any>) {
  const container = containerRef.current!;
  if (!container || index < 0) {
    return;
  }
  const { visibleIndexes, allElements } = findInViewport(
    container,
    '.chat-item-clickable',
    VIEWPORT_MARGIN,
    true,
    true,
  );
  if (!allElements.length || !allElements[index]) {
    return;
  }
  const first = visibleIndexes[0];
  if (!visibleIndexes.includes(index)
    || (index === first && !isFullyVisible(container, allElements[first]))) {
    const position = index > visibleIndexes[visibleIndexes.length - 1] ? 'start' : 'end';
    fastSmoothScroll(container, allElements[index], position, SCROLL_MARGIN);
  }
}

export type OwnProps = {
  isOpen: boolean;
  filter: string;
  onClose: () => void;
  onInsertUserName: (user: ApiUser, forceFocus?: boolean) => void;
  filteredChatMembers?: ApiChatMember[];
  usersById?: Record<number, ApiUser>;
};

const MentionMenu: FC<OwnProps> = ({
  isOpen,
  filter,
  onClose,
  onInsertUserName,
  usersById,
  filteredChatMembers,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);

  const getSelectedIndex = useCallback((newIndex: number) => {
    if (!filteredChatMembers) {
      return -1;
    }
    const membersCount = filteredChatMembers!.length;
    return cycleRestrict(membersCount, newIndex);
  }, [filteredChatMembers]);

  const [selectedMentionIndex, setSelectedMentionIndex] = useState(-1);

  const handleArrowKey = useCallback((value: number, e: KeyboardEvent) => {
    e.preventDefault();
    setSelectedMentionIndex((index) => (getSelectedIndex(index + value)));
  }, [setSelectedMentionIndex, getSelectedIndex]);

  const handleUserSelect = useCallback((userId: number, forceFocus = false) => {
    const user = usersById && usersById[userId];
    if (!user) {
      return;
    }

    onInsertUserName(user, forceFocus);
  }, [usersById, onInsertUserName]);

  const handleSelectMention = useCallback((e: KeyboardEvent) => {
    if (filteredChatMembers && filteredChatMembers.length && selectedMentionIndex > -1) {
      const member = filteredChatMembers[selectedMentionIndex];
      if (member) {
        e.preventDefault();
        handleUserSelect(member.userId, true);
      }
    }
  }, [filteredChatMembers, selectedMentionIndex, handleUserSelect]);

  useEffect(() => (isOpen ? captureKeyboardListeners({
    onEsc: onClose,
    onUp: (e: KeyboardEvent) => handleArrowKey(-1, e),
    onDown: (e: KeyboardEvent) => handleArrowKey(1, e),
    onEnter: handleSelectMention,
    onTab: handleSelectMention,
  }) : undefined), [isOpen, onClose, handleArrowKey, handleSelectMention]);

  useEffect(() => {
    if (filteredChatMembers && !filteredChatMembers.length) {
      onClose();
    }
  }, [filteredChatMembers, onClose]);

  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [filter]);

  useEffect(() => {
    setItemVisible(selectedMentionIndex, containerRef);
  }, [selectedMentionIndex]);

  const prevChatMembers = usePrevious(
    filteredChatMembers && filteredChatMembers.length
      ? filteredChatMembers
      : undefined,
    shouldRender,
  );
  const renderedChatMembers = filteredChatMembers && !filteredChatMembers.length
    ? prevChatMembers
    : filteredChatMembers;

  if (!shouldRender || (renderedChatMembers && !renderedChatMembers.length)) {
    return undefined;
  }

  const className = buildClassName(
    'MentionMenu custom-scroll',
    transitionClassNames,
  );

  return (
    <div className={className} ref={containerRef}>
      {renderedChatMembers && renderedChatMembers.map(({ userId }, index) => (
        <ListItem
          key={userId}
          className="chat-item-clickable scroll-item"
          onClick={() => handleUserSelect(userId)}
          focus={selectedMentionIndex === index}
        >
          <PrivateChatInfo
            userId={userId}
            avatarSize="small"
            withUsername
          />
        </ListItem>
      ))}
    </div>
  );
};

export default memo(MentionMenu);
