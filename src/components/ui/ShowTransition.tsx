import type { FC } from '../../lib/teact/teact';
import React, { useRef } from '../../lib/teact/teact';

import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import useShowTransition from '../../hooks/useShowTransition';

type OwnProps = {
  isOpen: boolean;
  isCustom?: boolean;
  isHidden?: boolean;
  id?: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  noCloseTransition?: boolean;
  shouldAnimateFirstRender?: boolean;
  style?: string;
  children: React.ReactNode;
  ref?: React.RefObject<HTMLDivElement>;
};

const ShowTransition: FC<OwnProps> = ({
  isOpen,
  isHidden,
  isCustom,
  id,
  className,
  onClick,
  children,
  noCloseTransition,
  shouldAnimateFirstRender,
  style,
  ref: externalRef,
}) => {
  const prevIsOpen = usePreviousDeprecated(isOpen);
  const prevChildren = usePreviousDeprecated(children);
  const fromChildrenRef = useRef<React.ReactNode>();
  const isFirstRender = prevIsOpen === undefined;

  const { ref, shouldRender } = useShowTransition({
    isOpen: isOpen && !isHidden,
    ref: externalRef,
    noMountTransition: isFirstRender && !shouldAnimateFirstRender,
    className: isCustom ? false : undefined,
    noCloseTransition,
    withShouldRender: true,
  });

  if (prevIsOpen && !isOpen) {
    fromChildrenRef.current = prevChildren;
  }

  return (
    (shouldRender || isHidden) && (
      <div
        id={id}
        ref={ref}
        className={className}
        onClick={onClick}
        style={style}
      >
        {isOpen ? children : fromChildrenRef.current!}
      </div>
    )
  );
};

export default ShowTransition;
