import { memo, useCallback, useRef } from '../../lib/teact/teact';

import type { GlobalState } from '../../global/types';

import { getPeerTitle } from '../../global/helpers/peers';
import { selectPeer } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import renderText from './helpers/renderText';

import useSelector from '../../hooks/data/useSelector';
import useClickable from '../../hooks/useClickable';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Avatar from './Avatar';
import Icon from './icons/Icon';

import styles from './ListTopPeers.module.scss';

type OwnProps = {
  peerIds: string[];
  currentUserId?: string;
  selectedIds?: string[];
  onPeerClick: (id: string) => void;
};

const NBSP = ' ';

const ListTopPeers = ({
  peerIds,
  currentUserId,
  selectedIds,
  onPeerClick,
}: OwnProps) => {
  const ref = useRef<HTMLDivElement>();

  const lang = useLang();

  useHorizontalScroll(ref, !peerIds.length);

  const displayIds = currentUserId
    ? [currentUserId, ...peerIds.filter((id) => id !== currentUserId)]
    : peerIds;

  if (!displayIds.length) {
    return undefined;
  }

  return (
    <div ref={ref} className={styles.scroll} dir={lang.isRtl ? 'rtl' : undefined}>
      {displayIds.map((peerId) => (
        <ListTopPeerItem
          key={peerId}
          peerId={peerId}
          isSelf={peerId === currentUserId}
          isSelected={selectedIds?.includes(peerId)}
          onClick={onPeerClick}
        />
      ))}
    </div>
  );
};

type ItemProps = {
  peerId: string;
  isSelf?: boolean;
  isSelected?: boolean;
  onClick: (id: string) => void;
};

const ListTopPeerItem = memo(({
  peerId,
  isSelf,
  isSelected,
  onClick,
}: ItemProps) => {
  const lang = useLang();

  const peerSelector = useCallback((global: GlobalState) => selectPeer(global, peerId), [peerId]);
  const peer = useSelector(peerSelector);

  const handleClick = useLastCallback(() => onClick(peerId));
  const clickableProps = useClickable<HTMLDivElement>(handleClick);

  if (!peer) {
    return undefined;
  }

  const name = isSelf ? lang('SavedMessagesShort') : getPeerTitle(lang, peer);

  return (
    <div
      className={buildClassName(styles.item, isSelected && styles.selected)}
      aria-pressed={isSelected}
      {...clickableProps}
    >
      <div className={styles.avatarWrapper}>
        <Avatar peer={peer} isSavedMessages={isSelf} size={48} />
        <div className={styles.checkmark}>
          <Icon name="check-bold" />
        </div>
      </div>
      <div className={styles.name}>{renderText(name || NBSP)}</div>
    </div>
  );
});

export default memo(ListTopPeers);
