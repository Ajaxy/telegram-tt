import type { FC, VirtualElement } from '../../lib/teact/teact';
import { useLayoutEffect, useRef } from '../../lib/teact/teact';
import TeactDOM from '../../lib/teact/teact-dom';

type OwnProps = {
  containerSelector?: string;
  className?: string;
  children: VirtualElement;
};

const Portal: FC<OwnProps> = ({ containerSelector, className, children }) => {
  // eslint-disable-next-line @eslint-react/purity
  const elementRef = useRef<HTMLDivElement>(document.createElement('div'));

  useLayoutEffect(() => {
    const container = document.querySelector<HTMLDivElement>(containerSelector || '#portals');
    if (!container) {
      return undefined;
    }

    const element = elementRef.current;
    if (className) {
      element.classList.add(className);
    }

    container.appendChild(element);

    return () => {
      TeactDOM.render(undefined, element);
      container.removeChild(element);
    };
  }, [className, containerSelector]);

  return TeactDOM.render(children, elementRef.current);
};

export default Portal;
