import type { FC } from '../../lib/teact/teact';
import React, { useRef } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import usePrevious from '../../hooks/usePrevious';
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
  ref?: React.LegacyRef<HTMLDivElement>;
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
  ref,
}) => {
  const prevIsOpen = usePrevious(isOpen);
  const prevChildren = usePrevious(children);
  const fromChildrenRef = useRef<React.ReactNode>();
  const isFirstRender = prevIsOpen === undefined;
  const {
    shouldRender,
    transitionClassNames,
  } = useShowTransition(
    isOpen && !isHidden,
    undefined,
    isFirstRender && !shouldAnimateFirstRender,
    isCustom ? false : undefined,
    noCloseTransition,
  );

  if (prevIsOpen && !isOpen) {
    fromChildrenRef.current = prevChildren;
  }

  return (
    (shouldRender || isHidden) && (
      <div
        id={id}
        ref={ref}
        className={buildClassName(className, transitionClassNames)}
        onClick={onClick}
        style={style}
      >
        {isOpen ? children : fromChildrenRef.current!}
      </div>
    )
  );
};

export default ShowTransition;
