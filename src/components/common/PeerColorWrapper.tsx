import React, { memo } from '../../lib/teact/teact';

import type { ApiPeer } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { getPeerColorClass } from './helpers/peerColor';

import EmojiIconBackground from './embedded/EmojiIconBackground';

type OwnProps = {
  peer?: ApiPeer;
  noUserColors?: boolean;
  shoudReset?: boolean;
  className?: string;
  emojiIconClassName?: string;
  children: React.ReactNode;
};

function PeerColorWrapper({
  peer, noUserColors, shoudReset, className, emojiIconClassName, children,
}: OwnProps) {
  return (
    <div className={buildClassName(getPeerColorClass(peer, noUserColors, shoudReset), className)}>
      {peer?.color?.backgroundEmojiId && (
        <EmojiIconBackground
          className={emojiIconClassName}
          emojiDocumentId={peer.color.backgroundEmojiId}
        />
      )}
      {children}
    </div>
  );
}

export default memo(PeerColorWrapper);
