import { memo } from '../../lib/teact/teact';

import type { ApiPeer } from '../../api/types';

import { REM } from './helpers/mediaDimensions';

import Avatar from './Avatar';
import Icon from './icons/Icon';

import styles from './TransferBetweenPeers.module.scss';

type OwnProps = {
  fromPeer?: ApiPeer;
  toPeer?: ApiPeer;
  avatarSize?: number;
};

const DEFAULT_AVATAR_SIZE = 4 * REM;

const TransferBetweenPeers = ({ fromPeer, toPeer, avatarSize = DEFAULT_AVATAR_SIZE }: OwnProps) => {
  return (
    <div className={styles.root}>
      <Avatar peer={fromPeer} size={avatarSize} />
      <Icon name="next" className={styles.arrow} />
      <Avatar peer={toPeer} size={avatarSize} />
    </div>
  );
};

export default memo(TransferBetweenPeers);
