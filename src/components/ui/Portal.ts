import type { VirtualElement } from '../../lib/teact/teact';
import { useLayoutEffect, useRef } from '../../lib/teact/teact';
import TeactDOM from '../../lib/teact/teact-dom';

type OwnProps = {
  containerSelector?: string;
  containerElement?: HTMLElement;
  className?: string;
  children: VirtualElement;
};

const Portal = ({
  containerSelector, containerElement, className, children,
}: OwnProps) => {
  // eslint-disable-next-line @eslint-react/purity
  const elementRef = useRef<HTMLDivElement>(document.createElement('div'));

  // Assigning the whole string also drops the classes of a previous value
  useLayoutEffect(() => {
    elementRef.current.className = className || '';
  }, [className]);

  // A new container adopts the element, so the content keeps its state
  useLayoutEffect(() => {
    const container = containerElement
      || document.querySelector<HTMLDivElement>(containerSelector || '#portals');

    if (!container) {
      return undefined;
    }

    const element = elementRef.current;
    container.appendChild(element);

    return () => {
      element.remove();
    };
  }, [containerSelector, containerElement]);

  useLayoutEffect(() => {
    const element = elementRef.current;

    return () => {
      TeactDOM.render(undefined, element);
    };
  }, []);

  return TeactDOM.render(children, elementRef.current);
};

export default Portal;
