import { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import type { ApiUser } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';

import useFrozenProps from '../../../hooks/useFrozenProps';
import useLastCallback from '../../../hooks/useLastCallback';

import ListItem from '../../ui/ListItem';
import PrivateChatInfo from '../PrivateChatInfo';
import RichEditorTooltipPanel from './RichEditorTooltipPanel';

import styles from './MentionTooltip.module.scss';
import sharedStyles from './RichEditorTooltip.module.scss';

export type OwnProps = {
  isOpen: boolean;
  selectedIndex: number;
  onInsertUserName: (user: ApiUser, forceFocus?: boolean) => void;
  filteredUsers?: ApiUser[];
};

const MentionTooltip = ({ isOpen, ...props }: OwnProps) => {
  const {
    selectedIndex,
    onInsertUserName,
    filteredUsers,
  } = useFrozenProps(props, !isOpen);

  const containerRef = useRef<HTMLDivElement>();

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

  useEffect(() => {
    containerRef.current?.querySelector<HTMLElement>('.focus')?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!filteredUsers?.length) {
    return undefined;
  }

  return (
    <RichEditorTooltipPanel isOpen={isOpen}>
      <div
        ref={containerRef}
        className={buildClassName(sharedStyles.root, styles.root, 'composer-tooltip custom-scroll')}
      >
        {filteredUsers.map(({ id }, index) => (
          <ListItem
            key={id}
            className="chat-item-clickable scroll-item smaller-icon"
            onClick={handleClick}
            clickArg={id}
            focus={selectedIndex === index}
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
    </RichEditorTooltipPanel>
  );
};

export default memo(MentionTooltip);
