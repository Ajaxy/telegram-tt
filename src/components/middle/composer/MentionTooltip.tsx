import React, {
  FC, useCallback, useEffect, useState, useRef, memo,
} from '../../../lib/teact/teact';
import usePrevious from '../../../hooks/usePrevious';

import { ApiUser } from '../../../api/types';

import useShowTransition from '../../../hooks/useShowTransition';
import buildClassName from '../../../util/buildClassName';
import captureKeyboardListeners from '../../../util/captureKeyboardListeners';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';
import cycleRestrict from '../../../util/cycleRestrict';

import ListItem from '../../ui/ListItem';
import PrivateChatInfo from '../../common/PrivateChatInfo';

import './MentionTooltip.scss';

export type OwnProps = {
  isOpen: boolean;
  filter: string;
  onClose: () => void;
  onInsertUserName: (user: ApiUser, forceFocus?: boolean) => void;
  filteredUsers?: ApiUser[];
  usersById?: Record<number, ApiUser>;
};

const MentionTooltip: FC<OwnProps> = ({
  isOpen,
  filter,
  onClose,
  onInsertUserName,
  usersById,
  filteredUsers,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);

  const getSelectedIndex = useCallback((newIndex: number) => {
    if (!filteredUsers) {
      return -1;
    }
    const membersCount = filteredUsers!.length;
    return cycleRestrict(membersCount, newIndex);
  }, [filteredUsers]);

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
    if (filteredUsers && filteredUsers.length && selectedMentionIndex > -1) {
      const member = filteredUsers[selectedMentionIndex];
      if (member) {
        e.preventDefault();
        handleUserSelect(member.id, true);
      }
    }
  }, [filteredUsers, selectedMentionIndex, handleUserSelect]);

  useEffect(() => (isOpen ? captureKeyboardListeners({
    onEsc: onClose,
    onUp: (e: KeyboardEvent) => handleArrowKey(-1, e),
    onDown: (e: KeyboardEvent) => handleArrowKey(1, e),
    onEnter: handleSelectMention,
    onTab: handleSelectMention,
  }) : undefined), [isOpen, onClose, handleArrowKey, handleSelectMention]);

  useEffect(() => {
    if (filteredUsers && !filteredUsers.length) {
      onClose();
    }
  }, [filteredUsers, onClose]);

  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [filter]);

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedMentionIndex, containerRef);
  }, [selectedMentionIndex]);

  const prevChatMembers = usePrevious(
    filteredUsers && filteredUsers.length
      ? filteredUsers
      : undefined,
    shouldRender,
  );
  const renderedChatMembers = filteredUsers && !filteredUsers.length
    ? prevChatMembers
    : filteredUsers;

  if (!shouldRender || (renderedChatMembers && !renderedChatMembers.length)) {
    return undefined;
  }

  const className = buildClassName(
    'MentionTooltip composer-tooltip custom-scroll',
    transitionClassNames,
  );

  return (
    <div className={className} ref={containerRef}>
      {renderedChatMembers && renderedChatMembers.map(({ id }, index) => (
        <ListItem
          key={id}
          className="chat-item-clickable scroll-item"
          onClick={() => handleUserSelect(id)}
          focus={selectedMentionIndex === index}
        >
          <PrivateChatInfo
            userId={id}
            avatarSize="small"
            withUsername
          />
        </ListItem>
      ))}
    </div>
  );
};

export default memo(MentionTooltip);
