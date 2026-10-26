import {
  memo, useEffect, useRef, useState,
} from '../../../lib/teact/teact';

import type { ApiUser } from '../../../api/types';

import { getMainUsername, getUserFullName } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { getAddressGroupSeparator, getIsAlternateAddressGroup, splitAddressIntoGroups } from '../../../util/tonAddress';
import renderText from '../../common/helpers/renderText';

import useLang from '../../../hooks/useLang';

import Avatar from '../../common/Avatar';
import GramIcon from '../../common/icons/GramIcon';
import Button from '../../ui/Button';
import WalletRecipientMatrix from './WalletRecipientMatrix';

import styles from './WalletRecipientChip.module.scss';

type OwnProps = {
  address: string;
  user?: ApiUser;
  infoLabel: string;
  isResolved: boolean;
  isActive: boolean;
  noAnimation?: boolean;
  onCopyAddress: NoneToVoidFunction;
  onOpenChat?: NoneToVoidFunction;
  onOpenInfo?: NoneToVoidFunction;
};

// Two lines of six groups fit the chip, where the usual four would take three
const ADDRESS_GROUPS_PER_LINE = 6;
const AVATAR_SIZE = 36;
const RESOLVE_TIMEOUT = 2000;

const WalletRecipientChip = ({
  address, user, infoLabel, isResolved, isActive, noAnimation,
  onCopyAddress, onOpenChat, onOpenInfo,
}: OwnProps) => {
  const lang = useLang();

  const ref = useRef<HTMLDivElement>();
  const avatarRef = useRef<HTMLDivElement>();

  // The chip waits for the server to tell whether the address belongs to someone, so it is assembled once and whole
  const [timedOutAddress, setTimedOutAddress] = useState<string>();
  const isReady = isResolved || timedOutAddress === address;

  useEffect(() => {
    if (isReady) return undefined;

    const timeout = window.setTimeout(() => setTimedOutAddress(address), RESOLVE_TIMEOUT);

    return () => window.clearTimeout(timeout);
  }, [isReady, address]);

  const name = user && getUserFullName(lang, user);
  const username = user && getMainUsername(user);
  const addressGroups = splitAddressIntoGroups(address);

  return (
    <div ref={ref} className={buildClassName(styles.root, !isReady && styles.resolving)}>
      {user ? (
        <Avatar
          containerRef={avatarRef}
          peer={user}
          size={AVATAR_SIZE}
          className={styles.avatar}
          onClick={onOpenChat}
        />
      ) : (
        <span className={styles.walletIcon}>
          <GramIcon isMono className={styles.walletGlyph} />
        </span>
      )}
      <div className={styles.body}>
        <div className={styles.label}>
          <span className={styles.name} data-matrix="name">
            {name !== undefined ? renderText(name) : lang('WalletRecipientGramWallet')}
          </span>
          {username && (
            <span className={styles.username} data-matrix="username">{`@${username}`}</span>
          )}
        </div>
        <button
          type="button"
          className={styles.address}
          data-matrix="address"
          onClick={onCopyAddress}
        >
          {addressGroups.map((group, i) => (
            <span
              key={i}
              className={getIsAlternateAddressGroup(i, ADDRESS_GROUPS_PER_LINE) ? styles.addressAccent : undefined}
            >
              {group}
              {getAddressGroupSeparator(i, addressGroups.length, ADDRESS_GROUPS_PER_LINE)}
            </span>
          ))}
        </button>
      </div>
      <Button
        round
        size="smaller"
        color="translucent-primary"
        className={styles.info}
        iconName="help"
        ariaLabel={infoLabel}
        disabled={!onOpenInfo}
        onClick={onOpenInfo}
      />
      <WalletRecipientMatrix
        chipRef={ref}
        avatarRef={avatarRef}
        assemblingClassName={styles.assembling}
        playKey={isActive && isReady ? `${address}${user?.id ?? ''}` : undefined}
        noAnimation={noAnimation}
      />
    </div>
  );
};

export default memo(WalletRecipientChip);
