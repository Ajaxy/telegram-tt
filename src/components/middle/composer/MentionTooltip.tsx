import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
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
  anchorRect?: () => DOMRect | undefined;
  onClose: () => void;
  onInsertUserName: (user: ApiUser, forceFocus?: boolean) => void;
  filteredUsers?: ApiUser[];
};

const MentionTooltip: FC<OwnProps> = ({
  isOpen,
  anchorRect,
  onClose,
  onInsertUserName,
  filteredUsers,
}) => {
  const containerRef = useRef<HTMLDivElement>();
  const [style, setStyle] = useState<string | undefined>();
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

  useEffect(() => {
    let isCancelled = false;

    requestMeasure(() => {
      const anchor = anchorRect?.();
      const container = containerRef.current?.parentElement;
      const nextStyle = anchor && container ? buildAnchorStyle(anchor, container.getBoundingClientRect()) : undefined;

      requestMutation(() => {
        if (!isCancelled) {
          setStyle(nextStyle);
        }
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [anchorRect, isOpen, filteredUsers]);

  const prevChatMembers = usePreviousDeprecated(
    filteredUsers?.length
      ? filteredUsers
      : undefined,
    shouldRender,
  );
  const renderedChatMembers = filteredUsers?.length
    ? filteredUsers
    : prevChatMembers;

  if (!shouldRender || (renderedChatMembers && !renderedChatMembers.length)) {
    return undefined;
  }

  const className = buildClassName(
    'MentionTooltip composer-tooltip custom-scroll',
    transitionClassNames,
  );

  return (
    <div className={className} ref={containerRef} style={style}>
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
            noUserStatus
          />
        </ListItem>
      ))}
    </div>
  );
};

export default memo(MentionTooltip);

function buildAnchorStyle(anchor: DOMRect, container: DOMRect) {
  return [
    `left: ${anchor.left - container.left}px;`,
    `top: ${anchor.top - container.top}px;`,
    'bottom: auto; width: max-content;',
    'transform: translateY(calc(-100% - 0.5rem));',
  ].join(' ');
}
