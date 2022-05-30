import type { FC, VirtualElement } from '../../lib/teact/teact';
import { useRef, useLayoutEffect } from '../../lib/teact/teact';
import TeactDOM from '../../lib/teact/teact-dom';

type OwnProps = {
  containerId?: string;
  className?: string;
  children: VirtualElement;
};

const Portal: FC<OwnProps> = ({ containerId, className, children }) => {
  const elementRef = useRef<HTMLDivElement>();
  if (!elementRef.current) {
    elementRef.current = document.createElement('div');
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
      TeactDOM.render(undefined, element);
      container.removeChild(element);
    };
  }, [className, containerId]);

  return TeactDOM.render(children, elementRef.current);
};

export default Portal;
