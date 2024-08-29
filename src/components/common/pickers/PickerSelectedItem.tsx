import type { TeactNode } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiChat, ApiUser } from '../../../api/types';
import type { CustomPeer } from '../../../types';
import type { IconName } from '../../../types/icons';

import { getChatTitle, getUserFirstOrLastName } from '../../../global/helpers';
import { selectChat, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { getPeerColorClass } from '../helpers/peerColor';
import renderText from '../helpers/renderText';

import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../Avatar';
import Icon from '../icons/Icon';

import './PickerSelectedItem.scss';

type OwnProps<T = undefined> = {
  // eslint-disable-next-line react/no-unused-prop-types
  peerId?: string;
  // eslint-disable-next-line react/no-unused-prop-types
  forceShowSelf?: boolean;
  customPeer?: CustomPeer;
  icon?: IconName;
  title?: string;
  isMinimized?: boolean;
  canClose?: boolean;
  className?: string;
  fluid?: boolean;
  withPeerColors?: boolean;
  clickArg: T;
  onClick: (arg: T) => void;
};

type StateProps = {
  chat?: ApiChat;
  user?: ApiUser;
  isSavedMessages?: boolean;
};

// eslint-disable-next-line @typescript-eslint/comma-dangle
const PickerSelectedItem = <T,>({
  icon,
  title,
  isMinimized,
  canClose,
  clickArg,
  chat,
  user,
  customPeer,
  className,
  fluid,
  isSavedMessages,
  withPeerColors,
  onClick,
}: OwnProps<T> & StateProps) => {
  const lang = useOldLang();

  let iconElement: TeactNode | undefined;
  let titleText: any;

  if (icon && title) {
    iconElement = (
      <div className="item-icon">
        <Icon name={icon} />
      </div>
    );

    titleText = title;
  } else if (customPeer || user || chat) {
    iconElement = (
      <Avatar
        peer={customPeer || user || chat}
        size="small"
        isSavedMessages={isSavedMessages}
      />
    );

    const name = (customPeer && lang(customPeer.titleKey))
      || (!chat || (user && !isSavedMessages)
        ? getUserFirstOrLastName(user)
        : getChatTitle(lang, chat, isSavedMessages));

    titleText = title || (name ? renderText(name) : undefined);
  }

  const fullClassName = buildClassName(
    'PickerSelectedItem',
    className,
    (chat?.isForum || customPeer?.isAvatarSquare) && 'square-avatar',
    isMinimized && 'minimized',
    canClose && 'closeable',
    fluid && 'fluid',
    withPeerColors && getPeerColorClass(customPeer || chat || user),
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
          <Icon name="close" />
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
)(PickerSelectedItem)) as typeof PickerSelectedItem;
