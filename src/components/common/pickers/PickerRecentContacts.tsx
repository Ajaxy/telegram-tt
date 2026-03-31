import { memo, useRef } from '../../../lib/teact/teact';
import { getGlobal } from '../../../global';

import { getPeerTitle } from '../../../global/helpers/peers';
import { selectPeer } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import renderText from '../helpers/renderText';

import useHorizontalScroll from '../../../hooks/useHorizontalScroll';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Avatar from '../Avatar';
import Icon from '../icons/Icon';

import styles from './PickerRecentContacts.module.scss';

type OwnProps = {
  contactIds: string[];
  currentUserId?: string;
  selectedIds?: string[];
  className?: string;
  onSelect: (id: string) => void;
};

const PickerRecentContacts = ({
  contactIds,
  currentUserId,
  selectedIds,
  className,
  onSelect,
}: OwnProps) => {
  const lang = useLang();
  const containerRef = useRef<HTMLDivElement>();

  useHorizontalScroll(containerRef, !contactIds.length);

  const handleClick = useLastCallback((id: string) => {
    onSelect(id);
  });

  // Current user (Saved Messages) goes first, then contacts
  const displayIds = currentUserId
    ? [currentUserId, ...contactIds.filter((id) => id !== currentUserId)]
    : contactIds;

  if (!displayIds.length) {
    return undefined;
  }

  return (
    <div className={buildClassName(styles.root, className)} dir={lang.isRtl ? 'rtl' : undefined}>
      <div ref={containerRef} className={styles.scrollContainer}>
        {displayIds.map((peerId) => {
          const global = getGlobal();
          const peer = selectPeer(global, peerId);
          if (!peer) return undefined;

          const isSelf = peerId === currentUserId;
          const isSelected = selectedIds?.includes(peerId);
          const name = isSelf ? lang('SavedMessagesShort') : getPeerTitle(lang, peer);

          return (
            <div
              key={peerId}
              className={buildClassName(styles.item, isSelected && styles.selected)}
              onClick={() => handleClick(peerId)}
            >
              <div className={styles.avatarWrapper}>
                <Avatar
                  peer={peer}
                  isSavedMessages={isSelf}
                  size={48}
                />
                <div className={styles.checkmark}>
                  <Icon name="check-bold" />
                </div>
              </div>
              <div className={styles.name}>{renderText(name || lang('ActionFallbackSomeone'))}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(PickerRecentContacts);
