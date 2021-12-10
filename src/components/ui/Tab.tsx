import React, {
  FC, useRef, memo, useEffect,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import forceReflow from '../../util/forceReflow';
import renderText from '../common/helpers/renderText';

import './Tab.scss';

type OwnProps = {
  className?: string;
  title: string;
  isActive?: boolean;
  badgeCount?: number;
  isBadgeActive?: boolean;
  previousActiveTab?: number;
  onClick: (arg: number) => void;
  clickArg: number;
};

const classNames = {
  active: 'Tab--active',
  badgeActive: 'Tab__badge--active',
};

const Tab: FC<OwnProps> = ({
  className,
  title,
  isActive,
  badgeCount,
  isBadgeActive,
  previousActiveTab,
  onClick,
  clickArg,
}) => {
  // eslint-disable-next-line no-null/no-null
  const tabRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Set initial active state
    if (isActive && previousActiveTab === undefined && tabRef.current) {
      tabRef.current.classList.add(classNames.active);
    }

    if (!isActive || previousActiveTab === undefined) {
      return;
    }

    const tabEl = tabRef.current!;
    const prevTabEl = tabEl.parentElement!.children[previousActiveTab];
    if (!prevTabEl) {
      return;
    }

    const platformEl = tabEl.querySelector('i')!;
    const prevPlatformEl = prevTabEl.querySelector('i')!;

    // We move and resize the platform, so it repeats the position and size of the previous one
    const shiftLeft = prevPlatformEl.parentElement!.offsetLeft - platformEl.parentElement!.offsetLeft;
    const scaleFactor = prevPlatformEl.clientWidth / platformEl.clientWidth;

    prevPlatformEl.classList.remove('animate');
    platformEl.classList.remove('animate');
    platformEl.style.transform = `translate3d(${shiftLeft}px, 0, 0) scale3d(${scaleFactor}, 1, 1)`;
    forceReflow(platformEl);
    platformEl.classList.add('animate');
    platformEl.style.transform = 'none';

    prevTabEl.classList.remove(classNames.active);
    tabEl.classList.add(classNames.active);
  }, [isActive, previousActiveTab]);

  return (
    <div
      className={buildClassName('Tab', className)}
      onClick={() => onClick(clickArg)}
      ref={tabRef}
    >
      <span>
        {renderText(title)}
        {!!badgeCount && (
          <span className={buildClassName('badge', isBadgeActive && classNames.badgeActive)}>{badgeCount}</span>
        )}
        <i />
      </span>
    </div>
  );
};

export default memo(Tab);
