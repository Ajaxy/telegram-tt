import type { FC } from '../../lib/teact/teact';
import React, { useRef } from '../../lib/teact/teact';

import useShowTransition from '../../hooks/useShowTransition';
import usePrevious from '../../hooks/usePrevious';
import buildClassName from '../../util/buildClassName';

type OwnProps = {
  isOpen: boolean;
  isCustom?: boolean;
  isHidden?: boolean;
  id?: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  noCloseTransition?: boolean;
  children: React.ReactNode;
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
}) => {
  const prevIsOpen = usePrevious(isOpen);
  const prevChildren = usePrevious(children);
  const fromChildrenRef = useRef<React.ReactNode>();
  const isFirstRender = prevIsOpen === undefined;
  const {
    shouldRender,
    transitionClassNames,
  } = useShowTransition(
    isOpen && !isHidden, undefined, isFirstRender, isCustom ? false : undefined, noCloseTransition,
  );

  if (prevIsOpen && !isOpen) {
    fromChildrenRef.current = prevChildren;
  }

  return (
    (shouldRender || isHidden) && (
      <div id={id} className={buildClassName(className, transitionClassNames)} onClick={onClick}>
        {isOpen ? children : fromChildrenRef.current!}
      </div>
    )
  );
};

export default ShowTransition;
