import React, { FC, useRef } from '../../lib/teact/teact';

import useShowTransition from '../../hooks/useShowTransition';
import usePrevious from '../../hooks/usePrevious';
import buildClassName from '../../util/buildClassName';


type OwnProps = {
  isOpen: boolean;
  isCustom?: boolean;
  id?: string;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLElement, MouseEvent>) => void;
  children: React.ReactNode;
};

const ShowTransition: FC<OwnProps> = ({
  isOpen, isCustom, id, className, onClick, children,
}) => {
  const { shouldRender, transitionClassNames } = useShowTransition(
    isOpen, undefined, undefined, isCustom ? false : undefined,
  );
  const prevIsOpen = usePrevious(isOpen);
  const prevChildren = usePrevious(children);
  const fromChildrenRef = useRef<React.ReactNode>();

  if (prevIsOpen && !isOpen) {
    fromChildrenRef.current = prevChildren;
  }

  return (
    shouldRender && (
      <div id={id} className={buildClassName(className, transitionClassNames)} onClick={onClick}>
        {isOpen ? children : fromChildrenRef.current!}
      </div>
    )
  );
};

export default ShowTransition;
