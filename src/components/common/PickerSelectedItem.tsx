import type { FC, TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiChat, ApiUser } from '../../api/types';
import type { IconName } from '../../types/icons';

import { getChatTitle, getUserFirstOrLastName } from '../../global/helpers';
import { selectChat, selectUser } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useLang from '../../hooks/useLang';

import Avatar from './Avatar';

import './PickerSelectedItem.scss';

type OwnProps = {
  peerId?: string;
  icon?: IconName;
  title?: string;
  isMinimized?: boolean;
  isStandalone?: boolean;
  canClose?: boolean;
  forceShowSelf?: boolean;
  clickArg?: any;
  className?: string;
  onClick: (arg: any) => void;
};

type StateProps = {
  chat?: ApiChat;
  user?: ApiUser;
  isSavedMessages?: boolean;
};

const PickerSelectedItem: FC<OwnProps & StateProps> = ({
  icon,
  title,
  isMinimized,
  isStandalone,
  canClose,
  clickArg,
  chat,
  user,
  className,
  isSavedMessages,
  onClick,
}) => {
  const lang = useLang();

  let iconElement: TeactNode | undefined;
  let titleText: any;

  if (icon && title) {
    iconElement = (
      <div className="item-icon">
        <i className={buildClassName('icon', `icon-${icon}`)} />
      </div>
    );

    titleText = title;
  } else if (user || chat) {
    iconElement = (
      <Avatar
        peer={user || chat}
        size="small"
        isSavedMessages={isSavedMessages}
      />
    );

    const name = !chat || (user && !isSavedMessages)
      ? getUserFirstOrLastName(user)
      : getChatTitle(lang, chat, isSavedMessages);

    titleText = name ? renderText(name) : undefined;
  }

  const fullClassName = buildClassName(
    'PickerSelectedItem',
    className,
    chat?.isForum && 'forum-avatar',
    isMinimized && 'minimized',
    canClose && 'closeable',
    isStandalone && 'standalone',
  );

  return (
    <div
      className={fullClassName}
      onClick={() => onClick(clickArg)}
      title={isMinimized ? titleText : undefined}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {iconElement}
      {!isMinimized && (
        <div className="item-name" dir="auto">
          {titleText}
        </div>
      )}
      {canClose && (
        <div className="item-remove">
          <i className="icon icon-close" />
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { peerId, forceShowSelf }): StateProps => {
    if (!peerId) {
      return {};
    }

    const chat = selectChat(global, peerId);
    const user = selectUser(global, peerId);
    const isSavedMessages = !forceShowSelf && user && user.isSelf;

    return {
      chat,
      user,
      isSavedMessages,
    };
  },
)(PickerSelectedItem));
