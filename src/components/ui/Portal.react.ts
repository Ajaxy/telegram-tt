/* eslint-disable no-null/no-null */
/* eslint-disable react/no-deprecated */
/* eslint-disable react/no-render-return-value */
import { useLayoutEffect, useRef } from 'react';
import { render } from 'react-dom';
import type { FC } from '../../lib/teact/teact';

type OwnProps = {
  containerId?: string;
  elementId?: string;
  className?: string;
  children: any;
};

const Portal: FC<OwnProps> = ({
  containerId, elementId, className, children,
}) => {
  const elementRef = useRef<HTMLDivElement>();
  if (!elementRef.current) {
    elementRef.current = document.createElement('div');
    if (elementId) {
      elementRef.current.setAttribute('id', elementId);
    }
  }

  useLayoutEffect(() => {
    const container = document.querySelector<HTMLDivElement>(containerId || '#portals');
    if (!container) {
      return undefined;
    }

    const element = elementRef.current!;
    if (className) {
      element.classList.add(className);
    }

    container.appendChild(element);

    return () => {
      // @ts-ignore
      render(null, element);
      container.removeChild(element);
    };
  }, [className, containerId]);

  return render(children, elementRef.current);
};

export default Portal;
