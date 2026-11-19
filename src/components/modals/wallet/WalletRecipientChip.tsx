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
import FakeIcon from '../../common/FakeIcon';
import GramIcon from '../../common/icons/GramIcon';
import VerifiedIcon from '../../common/VerifiedIcon';
import Button from '../../ui/Button';
import WalletRecipientMatrix from './WalletRecipientMatrix';

import styles from './WalletRecipientChip.module.scss';

type OwnProps = {
  address: string;
  user?: ApiUser;
  infoLabel: string;
  // The chip waits until the server tells if the address belongs to a user. So the chip appears one time, with all its
  // parts.
  isReady: boolean;
  isActive: boolean;
  noAnimation?: boolean;
  onCopyAddress: NoneToVoidFunction;
  onOpenChat?: NoneToVoidFunction;
  onOpenInfo?: NoneToVoidFunction;
  // The name and the address can be read: the chip is ready and its assembly has ended or did not run
  onReadableChange?: (isReadable: boolean) => void;
};

// Two lines of six groups fit the chip, where the usual four would take three
const ADDRESS_GROUPS_PER_LINE = 6;
const AVATAR_SIZE = 36;

const WalletRecipientChip = ({
  address, user, infoLabel, isReady, isActive, noAnimation,
  onCopyAddress, onOpenChat, onOpenInfo, onReadableChange,
}: OwnProps) => {
  const lang = useLang();

  const ref = useRef<HTMLDivElement>();
  const avatarRef = useRef<HTMLDivElement>();

  // Every new key plays the assembly again, and the drawn parts stay transparent until it ends. A key that comes back
  // after the chip was left plays again too.
  const playKey = isActive && isReady ? `${address}${user?.id ?? ''}` : undefined;
  const [assembledKey, setAssembledKey] = useState<string>();
  const isReadable = isReady && (!playKey || assembledKey === playKey);

  useEffect(() => {
    if (!playKey) setAssembledKey(undefined);
  }, [playKey]);

  useEffect(() => {
    onReadableChange?.(isReadable);
  }, [isReadable, onReadableChange]);

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
          {user?.isVerified && <VerifiedIcon />}
          {user?.fakeType && <FakeIcon fakeType={user.fakeType} />}
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
        playKey={playKey}
        noAnimation={noAnimation}
        onPlayEnd={setAssembledKey}
      />
    </div>
  );
};

export default memo(WalletRecipientChip);
