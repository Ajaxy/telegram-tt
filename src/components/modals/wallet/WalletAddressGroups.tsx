import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import {
  ADDRESS_GROUPS_PER_LINE, getAddressGroupSeparator, getIsAlternateAddressGroup, splitAddressIntoGroups,
} from '../../../util/tonAddress';

import styles from './WalletAddressGroups.module.scss';

type OwnProps = {
  address: string;
  groupsPerLine?: number;
  // Shades alternate like a chessboard, see `getIsAlternateAddressGroup`
  isCheckered?: boolean;
  className?: string;
  mutedClassName?: string;
};

const WalletAddressGroups = ({
  address, groupsPerLine = ADDRESS_GROUPS_PER_LINE, isCheckered, className, mutedClassName,
}: OwnProps) => {
  const groups = splitAddressIntoGroups(address);

  function getIsMuted(index: number) {
    return isCheckered ? getIsAlternateAddressGroup(index, groupsPerLine) : Boolean(index % 2);
  }

  return (
    <div className={buildClassName(styles.root, className)}>
      {groups.map((group, index) => (
        <span key={index} className={getIsMuted(index) ? (mutedClassName || styles.muted) : undefined}>
          {group}
          {getAddressGroupSeparator(index, groups.length, groupsPerLine)}
        </span>
      ))}
    </div>
  );
};

export default memo(WalletAddressGroups);
