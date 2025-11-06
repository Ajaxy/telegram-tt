import type { TeactNode } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiPeer } from '../../api/types';
import type { CustomPeer, ThemeKey } from '../../types';
import type { IconName } from '../../types/icons';

import { getPeerTitle, isApiPeerChat } from '../../global/helpers/peers';
import { selectPeer, selectTheme, selectUser } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';

import useLang from '../../hooks/useLang';
import usePeerColor from '../../hooks/usePeerColor';

import Avatar from './Avatar';
import FullNameTitle from './FullNameTitle';
import Icon from './icons/Icon';

import styles from './PeerChip.module.scss';

type OwnProps<T = undefined> = {

  peerId?: string;

  forceShowSelf?: boolean;
  customPeer?: CustomPeer;
  mockPeer?: ApiPeer;
  icon?: IconName;
  title?: string;
  isMinimized?: boolean;
  canClose?: boolean;
  isCloseNonDestructive?: boolean;
  className?: string;
  withPeerColors?: boolean;
  withEmojiStatus?: boolean;
  clickArg?: T;
  onClick?: (arg: T) => void;
  itemClassName?: string;
};

type StateProps = {
  peer?: ApiPeer;
  theme: ThemeKey;
  isSavedMessages?: boolean;
};

const PeerChip = <T,>({
  icon,
  title,
  isMinimized,
  canClose,
  isCloseNonDestructive,
  clickArg,
  peer,
  mockPeer,
  customPeer,
  className,
  isSavedMessages,
  withPeerColors,
  withEmojiStatus,
  itemClassName,
  theme,
  onClick,
}: OwnProps<T> & StateProps) => {
  const lang = useLang();

  const apiPeer = mockPeer || peer;
  const anyPeer = customPeer || apiPeer;

  const { className: peerColorClass, style: peerColorStyle } = usePeerColor({
    peer: anyPeer,
    theme,
  });

  const chat = apiPeer && isApiPeerChat(apiPeer) ? apiPeer : undefined;

  let iconElement: TeactNode | undefined;
  let titleElement: TeactNode | undefined;
  let titleText: string | undefined;

  if (icon && title) {
    iconElement = (
      <div className={styles.iconWrapper}>
        <Icon name={icon} style={styles.icon} />
      </div>
    );

    titleElement = title;
  } else if (anyPeer) {
    iconElement = (
      <Avatar
        className={styles.avatar}
        peer={anyPeer}
        size="small"
        isSavedMessages={isSavedMessages}
      />
    );

    titleText = getPeerTitle(lang, anyPeer) || title;
    titleElement = title || (
      <FullNameTitle peer={anyPeer} isSavedMessages={isSavedMessages} withEmojiStatus={withEmojiStatus} />
    );
  }

  const fullClassName = buildClassName(
    styles.root,
    (chat?.isForum || customPeer?.isAvatarSquare) && styles.squareAvatar,
    isMinimized && styles.minimized,
    canClose && styles.closeable,
    isCloseNonDestructive && styles.nonDestructive,
    !onClick && styles.notClickable,
    withPeerColors && peerColorClass,
    className,
  );

  const style = buildStyle(
    withPeerColors && peerColorStyle,
  );

  return (
    <div
      className={fullClassName}
      style={style}
      onClick={() => onClick?.(clickArg!)}
      title={isMinimized ? titleText : undefined}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {iconElement}
      {!isMinimized && (
        <div className={buildClassName(styles.name, itemClassName)} dir="auto">
          {titleElement}
        </div>
      )}
      {canClose && (
        <div className={styles.remove}>
          <Icon name="close" />
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { peerId, forceShowSelf }): Complete<StateProps> => {
    const theme = selectTheme(global);
    if (!peerId) {
      return {
        peer: undefined,
        isSavedMessages: undefined,
        theme,
      };
    }

    const peer = selectPeer(global, peerId);
    const user = selectUser(global, peerId);
    const isSavedMessages = !forceShowSelf && user && user.isSelf;

    return {
      peer,
      isSavedMessages,
      theme,
    };
  },
)(PeerChip)) as <T>(props: OwnProps<T>) => ReturnType<typeof PeerChip<T>>;
