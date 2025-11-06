import { memo, useRef } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiChat, ApiUser } from '../../api/types';

import buildClassName from '../../util/buildClassName';

import { getIsMobile } from '../../hooks/useAppLayout';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';

import StoryRibbonButton from './StoryRibbonButton';

import styles from './StoryRibbon.module.scss';

interface OwnProps {
  isArchived?: boolean;
  className?: string;
  isClosing?: boolean;
}

interface StateProps {
  orderedPeerIds: string[];
  usersById: Record<string, ApiUser>;
  chatsById: Record<string, ApiChat>;
}

function StoryRibbon({
  isArchived,
  className,
  orderedPeerIds,
  usersById,
  chatsById,
  isClosing,
}: OwnProps & StateProps) {
  const lang = useLang();
  const fullClassName = buildClassName(
    styles.root,
    !orderedPeerIds.length && styles.hidden,
    isClosing && styles.closing,
    className,
    'no-scrollbar',
  );

  const ref = useRef<HTMLDivElement>();

  useHorizontalScroll(ref, getIsMobile());

  return (
    <div
      ref={ref}
      id="StoryRibbon"
      className={fullClassName}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {orderedPeerIds.map((peerId) => {
        const peer = usersById[peerId] || chatsById[peerId];

        if (!peer) {
          return undefined;
        }

        return (
          <StoryRibbonButton
            key={peerId}
            peer={peer}
            isArchived={isArchived}
          />
        );
      })}
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { isArchived }): Complete<StateProps> => {
    const { orderedPeerIds: { active, archived } } = global.stories;
    const usersById = global.users.byId;
    const chatsById = global.chats.byId;

    return {
      orderedPeerIds: isArchived ? archived : active,
      usersById,
      chatsById,
    };
  },
)(StoryRibbon));
