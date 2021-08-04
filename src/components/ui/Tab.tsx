import React, {
  FC, useLayoutEffect, useRef, memo,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import renderText from '../common/helpers/renderText';

import './Tab.scss';

type OwnProps = {
  className?: string;
  title: string;
  active?: boolean;
  badgeCount?: number;
  isBadgeActive?: boolean;
  previousActiveTab?: number;
  onClick: (arg: number) => void;
  clickArg: number;
};

const Tab: FC<OwnProps> = ({
  className,
  title,
  active,
  badgeCount,
  isBadgeActive,
  previousActiveTab,
  onClick,
  clickArg,
}) => {
  // eslint-disable-next-line no-null/no-null
  const tabRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!active || previousActiveTab === undefined) {
      return;
    }

    const tab = tabRef.current!;
    const indicator = tab.querySelector('i')!;
    const prevTab = tab.parentElement!.children[previousActiveTab];
    if (!prevTab) {
      return;
    }
    const currentIndicator = prevTab.querySelector('i')!;

    currentIndicator.classList.remove('animate');
    indicator.classList.remove('animate');

    // We move and resize our indicator so it repeats the position and size of the previous one.
    const shiftLeft = currentIndicator.parentElement!.offsetLeft - indicator.parentElement!.offsetLeft;
    const scaleFactor = currentIndicator.clientWidth / indicator.clientWidth;
    indicator.style.transform = `translate3d(${shiftLeft}px, 0, 0) scale3d(${scaleFactor}, 1, 1)`;

    // 3 AFs needed here to synchronize animations with Transition component
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Now we remove the transform to let it animate to its own position and size.
          indicator.classList.add('animate');
          indicator.style.transform = 'none';
        });
      });
    });
  }, [active, previousActiveTab]);

  return (
    <button
      type="button"
      className={buildClassName('Tab', className, active && 'active')}
      onClick={() => onClick(clickArg)}
      ref={tabRef}
    >
      <span>
        {renderText(title)}
        {!!badgeCount && (
          <span className={buildClassName('badge', isBadgeActive && 'active')}>{badgeCount}</span>
        )}
        <i />
      </span>
    </button>
  );
};

export default memo(Tab);
