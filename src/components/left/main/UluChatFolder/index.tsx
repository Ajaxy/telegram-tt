import type { FC } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

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
  shouldStressUnreadMessages: boolean;
  onClick: NoneToVoidFunction;
};

const componentByType = {
  inbox: SvgInbox,
  'saved-messages': SvgSavedMessages,
  'archived-chats': SvgArchivedChats,
};

const UluChatFolder: FC<OwnProps> = ({
  active, type, title, messagesUnreadCount, onClick, shouldStressUnreadMessages,
}) => {
  const IconComponent = componentByType[type];

  const classNameWrapper = buildClassName(
    styles.wrapper,
    active && styles.active,
    !!messagesUnreadCount && shouldStressUnreadMessages && styles['has-unread-messages'],
  );
  const svgFill = active ? 'var(--color-text)' : 'var(--color-text-secondary)';

  // TODO use <ListItem/> with <Ripple/>
  return (
    <div
      className={classNameWrapper}
      onClick={onClick}
    >
      <div className={styles.info}>
        <div className={styles.iconWrapper}>
          <IconComponent
            height="1.25rem"
            width="1.25rem"
            fill={svgFill}
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
