import type { ElementRef } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';

import type { ApiPeer, ApiTypePeerColor } from '../../api/types';

import { selectTheme } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { REM } from './helpers/mediaDimensions';

import useSelector from '../../hooks/data/useSelector';
import usePeerColor from '../../hooks/usePeerColor';

import CustomEmoji from './CustomEmoji';
import EmojiIconBackground from './embedded/EmojiIconBackground';

import styles from './PeerColorWrapper.module.scss';

interface OwnProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: ElementRef<HTMLDivElement>;
  peer?: ApiPeer;
  peerColor?: ApiTypePeerColor;
  isReply?: boolean;
  noBar?: boolean;
  noUserColors?: boolean;
  shouldReset?: boolean;
  className?: string;
  emojiIconClassName?: string;
  children: React.ReactNode;
}

const GIFT_EMOJI_SIZE = 1.25 * REM;

function PeerColorWrapper({
  ref,
  peer,
  peerColor,
  isReply,
  noBar,
  noUserColors,
  shouldReset,
  className,
  emojiIconClassName,
  children,
  ...otherProps
}: OwnProps) {
  const color = peerColor || peer?.color;
  const theme = useSelector(selectTheme);

  const {
    style,
    className: peerColorClassName,
    backgroundEmojiId,
    giftEmojiId,
  } = usePeerColor({ peer, color, noUserColors, shouldReset, theme });
  const hasGiftEmoji = isReply && Boolean(giftEmojiId);

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.root,
        peerColorClassName,
        hasGiftEmoji && styles.hasGiftEmoji,
        !noBar && styles.withBar,
        className,
      )}
      style={style}
      {...otherProps}
    >
      {backgroundEmojiId && (
        <EmojiIconBackground
          className={emojiIconClassName}
          emojiDocumentId={backgroundEmojiId}
          withEmojiSpace={hasGiftEmoji}
        />
      )}
      {hasGiftEmoji && (
        <CustomEmoji
          className={styles.giftEmoji}
          documentId={giftEmojiId}
          size={GIFT_EMOJI_SIZE}
          noPlay
        />
      )}
      {children}
    </div>
  );
}

export default memo(PeerColorWrapper);
