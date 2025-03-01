import React, { memo } from '../../../../lib/teact/teact';

import type { ApiMessageActionChatEditPhoto } from '../../../../api/types/messageActions';

import { REM } from '../../../common/helpers/mediaDimensions';

import { type ObserveFn } from '../../../../hooks/useIntersectionObserver';

import Avatar from '../../../common/Avatar';

import styles from '../ActionMessage.module.scss';

type OwnProps = {
  action: ApiMessageActionChatEditPhoto;
  observeIntersection?: ObserveFn;
  onClick?: NoneToVoidFunction;
};

const AVATAR_SIZE = 15 * REM;

const ChannelPhotoAction = ({
  action,
  onClick,
  observeIntersection,
} : OwnProps) => {
  return (
    <Avatar
      className={styles.channelPhoto}
      photo={action.photo}
      loopIndefinitely
      withVideo
      observeIntersection={observeIntersection}
      onClick={onClick}
      size={AVATAR_SIZE}
    />
  );
};

export default memo(ChannelPhotoAction);
