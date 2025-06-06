import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';

import useLastCallback from '../../../hooks/useLastCallback';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import PrivateChatInfo from '../../common/PrivateChatInfo';
import ListItem from '../../ui/ListItem';

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
  const containerRef = useRef<HTMLDivElement>();
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen, undefined, undefined, false);

  const handleUserSelect = useLastCallback((userId: string, forceFocus = false) => {
    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    const user = usersById[userId];
    if (!user) {
      return;
    }

    onInsertUserName(user, forceFocus);
  });

  const handleClick = useLastCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();

    handleUserSelect(id);
  });

  const handleSelectMention = useLastCallback((member: ApiUser) => {
    handleUserSelect(member.id, true);
  });

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

  const prevChatMembers = usePreviousDeprecated(
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
          className="chat-item-clickable scroll-item smaller-icon"
          onClick={handleClick}
          clickArg={id}
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
