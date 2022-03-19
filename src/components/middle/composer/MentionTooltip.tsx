import React, {
  FC, useCallback, useEffect, useRef, memo,
} from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import { ApiUser } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';
import usePrevious from '../../../hooks/usePrevious';
import useShowTransition from '../../../hooks/useShowTransition';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import ListItem from '../../ui/ListItem';
import PrivateChatInfo from '../../common/PrivateChatInfo';

import './MentionTooltip.scss';

export type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
  onInsertUserName: (user: ApiUser, forceFocus?: boolean) => void;
  filteredUsers?: ApiUser[];
};

const MentionTooltip: FC<OwnProps> = ({
  isOpen,
  onClose,
  onInsertUserName,
  filteredUsers,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);

  const handleUserSelect = useCallback((userId: string, forceFocus = false) => {
    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    const user = usersById[userId];
    if (!user) {
      return;
    }

    onInsertUserName(user, forceFocus);
  }, [onInsertUserName]);

  const handleSelectMention = useCallback((member: ApiUser) => {
    handleUserSelect(member.id, true);
  }, [handleUserSelect]);

  const selectedMentionIndex = useKeyboardNavigation({
    isActive: isOpen,
    items: filteredUsers,
    onSelect: handleSelectMention,
    shouldSelectOnTab: true,
    shouldSaveSelectionOnUpdateItems: true,
    onClose,
  });

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedMentionIndex, containerRef);
  }, [selectedMentionIndex]);

  useEffect(() => {
    if (filteredUsers && !filteredUsers.length) {
      onClose();
    }
  }, [filteredUsers, onClose]);

  const prevChatMembers = usePrevious(
    filteredUsers?.length
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
      {renderedChatMembers?.map(({ id }, index) => (
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
