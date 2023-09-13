import React, { memo, useRef } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiUser } from '../../api/types';

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
  orderedUserIds: string[];
  usersById: Record<string, ApiUser>;
}

function StoryRibbon({
  isArchived, className, orderedUserIds, usersById, isClosing,
}: OwnProps & StateProps) {
  const lang = useLang();
  const fullClassName = buildClassName(
    styles.root,
    !orderedUserIds.length && styles.hidden,
    isClosing && styles.closing,
    className,
    'no-scrollbar',
  );

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  useHorizontalScroll(ref, getIsMobile());

  return (
    <div
      ref={ref}
      className={fullClassName}
      dir={lang.isRtl ? 'rtl' : undefined}
    >
      {orderedUserIds.map((userId) => {
        const user = usersById[userId];

        if (!user) {
          return undefined;
        }

        return (
          <StoryRibbonButton
            key={userId}
            user={user}
            isArchived={isArchived}
          />
        );
      })}
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { isArchived }): StateProps => {
    const { orderedUserIds: { active, archived } } = global.stories;
    const usersById = global.users.byId;

    return {
      orderedUserIds: isArchived ? archived : active,
      usersById,
    };
  },
)(StoryRibbon));
