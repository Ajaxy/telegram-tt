import React, { memo } from '../../lib/teact/teact';

import type { ApiPeer, ApiPeerColor } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { getApiPeerColorClass, getPeerColorClass } from './helpers/peerColor';

import EmojiIconBackground from './embedded/EmojiIconBackground';

import styles from './PeerColorWrapper.module.scss';

interface OwnProps extends React.HTMLAttributes<HTMLDivElement> {
  peer?: ApiPeer;
  peerColor?: ApiPeerColor;
  noUserColors?: boolean;
  shoudReset?: boolean;
  className?: string;
  emojiIconClassName?: string;
  children: React.ReactNode;
}

function PeerColorWrapper({
  peer, peerColor, noUserColors, shoudReset, className, emojiIconClassName, children, ...otherProps
}: OwnProps) {
  const color = peerColor || peer?.color;

  return (
    <div
      className={buildClassName(
        styles.root,
        peer && getPeerColorClass(peer, noUserColors, shoudReset),
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
