import type { TeactNode } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { CustomPeer } from '../../../types';
import type { IconName } from '../../../types/icons';

import { isApiPeerChat } from '../../../global/helpers/peers';
import { selectPeer, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { getPeerColorClass } from '../helpers/peerColor';

import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../Avatar';
import FullNameTitle from '../FullNameTitle';
import Icon from '../icons/Icon';

import './PickerSelectedItem.scss';

type OwnProps<T = undefined> = {
  // eslint-disable-next-line react/no-unused-prop-types
  peerId?: string;
  // eslint-disable-next-line react/no-unused-prop-types
  forceShowSelf?: boolean;
  customPeer?: CustomPeer;
  mockPeer?: ApiPeer;
  icon?: IconName;
  title?: string;
  isMinimized?: boolean;
  canClose?: boolean;
  className?: string;
  fluid?: boolean;
  withPeerColors?: boolean;
  clickArg?: T;
  onClick?: (arg: T) => void;
};

type StateProps = {
  peer?: ApiPeer;
  isSavedMessages?: boolean;
};

// eslint-disable-next-line @typescript-eslint/comma-dangle
const PickerSelectedItem = <T,>({
  icon,
  title,
  isMinimized,
  canClose,
  clickArg,
  peer,
  mockPeer,
  customPeer,
  className,
  fluid,
  isSavedMessages,
  withPeerColors,
  onClick,
}: OwnProps<T> & StateProps) => {
  const lang = useOldLang();

  const apiPeer = mockPeer || peer;
  const anyPeer = customPeer || apiPeer;

  const chat = apiPeer && isApiPeerChat(apiPeer) ? apiPeer : undefined;

  let iconElement: TeactNode | undefined;
  let titleText: any;

  if (icon && title) {
    iconElement = (
      <div className="item-icon">
        <Icon name={icon} />
      </div>
    );

    titleText = title;
  } else if (anyPeer) {
    iconElement = (
      <Avatar
        peer={anyPeer}
        size="small"
        isSavedMessages={isSavedMessages}
      />
    );

    titleText = title || <FullNameTitle peer={anyPeer} isSavedMessages={isSavedMessages} withEmojiStatus />;
  }

  const fullClassName = buildClassName(
    'PickerSelectedItem',
    className,
    (chat?.isForum || customPeer?.isAvatarSquare) && 'square-avatar',
    isMinimized && 'minimized',
    canClose && 'closeable',
    fluid && 'fluid',
    withPeerColors && getPeerColorClass(customPeer || peer),
  );

  return (
    <div
      className={fullClassName}
      onClick={() => onClick?.(clickArg!)}
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

    const peer = selectPeer(global, peerId);
    const user = selectUser(global, peerId);
    const isSavedMessages = !forceShowSelf && user && user.isSelf;

    return {
      peer,
      isSavedMessages,
    };
  },
)(PickerSelectedItem)) as typeof PickerSelectedItem;
