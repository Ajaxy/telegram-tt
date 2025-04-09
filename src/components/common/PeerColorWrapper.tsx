import React, { memo } from '../../lib/teact/teact';

import type { ApiPeer, ApiPeerColor } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { getApiPeerColorClass, getPeerColorClass } from './helpers/peerColor';

import EmojiIconBackground from './embedded/EmojiIconBackground';

import styles from './PeerColorWrapper.module.scss';

interface OwnProps extends React.HTMLAttributes<HTMLDivElement> {
  ref?: React.RefObject<HTMLDivElement>;
  peer?: ApiPeer;
  peerColor?: ApiPeerColor;
  noUserColors?: boolean;
  shouldReset?: boolean;
  className?: string;
  emojiIconClassName?: string;
  children: React.ReactNode;
}

function PeerColorWrapper({
  peer, ref, peerColor, noUserColors,
  shouldReset, className, emojiIconClassName,
  children, ...otherProps
}: OwnProps) {
  const color = peerColor || peer?.color;

  return (
    <div
      ref={ref}
      className={buildClassName(
        styles.root,
        peer && getPeerColorClass(peer, noUserColors, shouldReset),
        peerColor && getApiPeerColorClass(peerColor),
        className,
      )}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...otherProps}
    >
      {color?.backgroundEmojiId && (
        <EmojiIconBackground
          className={emojiIconClassName}
          emojiDocumentId={color.backgroundEmojiId}
        />
      )}
      {children}
    </div>
  );
}

export default memo(PeerColorWrapper);
