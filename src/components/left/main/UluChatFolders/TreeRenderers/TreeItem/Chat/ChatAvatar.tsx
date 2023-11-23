import React from 'react';
import type { FC } from '../../../../../../../lib/teact/teact';

import type { ApiChat } from '../../../../../../../api/types';

import buildClassName from '../../../../../../../util/buildClassName';

import Avatar from '../../../../../../common/Avatar.react';

import styles from './ChatAvatar.module.scss';

type OwnProps = {
  chat: ApiChat;
};

const ChatAvatar: FC<OwnProps> = ({ chat }) => {
  return (
    <div className={buildClassName('status', 'status-clickable')}>
      <Avatar
        className={styles.avatar}
        peer={chat}
        isSavedMessages={false}
        // withStory={!user?.isSelf}
        // withStoryGap={isAvatarOnlineShown}
        // storyViewerOrigin={StoryViewerOrigin.ChatList}
        // storyViewerMode="single-peer"
      />
      {/* <div className="avatar-badge-wrapper">
        <div className={buildClassName('avatar-online', isAvatarOnlineShown && 'avatar-online-shown')} />
        <ChatBadge chat={chat} isMuted={isMuted} shouldShowOnlyMostImportant forceHidden={getIsForumPanelClosed} />
      </div>
      {chat.isCallActive && chat.isCallNotEmpty && (
        <ChatCallStatus isMobile={isMobile} isSelected={isSelected} isActive={withInterfaceAnimations} />
      )} */}
    </div>
  );
};

export default ChatAvatar;
