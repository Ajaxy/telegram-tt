import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useState } from '../../../../lib/teact/teact';

import buildClassName from '../../../../util/buildClassName';

import SvgArchivedChats from './SvgArchivedChats';
import SvgInbox from './SvgInbox';
import SvgSavedMessages from './SvgSavedMessages';

import styles from './UluChatFolder.module.scss';

type OwnProps = {
  type: 'inbox' | 'saved-messages' | 'archived-chats';
  title: string;
  messagesUnreadCount?: number;
  active: boolean;
  onClick: NoneToVoidFunction;
};

const componentByType = {
  inbox: SvgInbox,
  'saved-messages': SvgSavedMessages,
  'archived-chats': SvgArchivedChats,
};

const UluChatFolder: FC<OwnProps> = ({
  active, type, title, messagesUnreadCount, onClick,
}) => {
  const IconComponent = componentByType[type];

  const [isHovered, setIsHovered] = useState(false);
  const handleMouseOver = () => setIsHovered(true);
  const handleMouseOut = () => setIsHovered(false);

  const classNameWrapper = buildClassName(
    styles.wrapper,
    active && styles.active,
  );

  // TODO use <ListItem/> with <Ripple/>
  return (
    <div
      className={classNameWrapper}
      onFocus={handleMouseOver}
      onMouseOver={handleMouseOver}
      onBlur={handleMouseOut}
      onMouseOut={handleMouseOut}
      onClick={onClick}
    >
      <div className={styles.info}>
        <div className={styles.iconWrapper}>
          <IconComponent
            height="1.25rem"
            width="1.25rem"
            fill={isHovered || active ? 'var(--color-white)' : 'var(--color-gray)'}
          />
        </div>
        <div className={styles.title}>
          {title}
        </div>
      </div>
      { !!messagesUnreadCount && (<div className={styles.unread}>{ messagesUnreadCount }</div>) }
    </div>
  );
};

export default memo(UluChatFolder);
