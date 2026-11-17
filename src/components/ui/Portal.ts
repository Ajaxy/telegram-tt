import { registerDelegatedDocument } from '../../lib/teact/dom-events';
import type { ElementRef, VirtualElement } from '../../lib/teact/teact';
import { createContext, createElement, useLayoutEffect, useRef, useState } from '../../lib/teact/teact';
import TeactDOM from '../../lib/teact/teact-dom';

import { requestForcedReflow } from '../../lib/fasterdom/fasterdom';
import buildClassName from '../../util/buildClassName';

import useContext from '../../hooks/data/useContext';
import useWindow, { WindowContext } from '../../hooks/useWindow';

const PortalContainerContext = createContext<ElementRef<HTMLElement> | undefined>(undefined);

type OwnProps = {
  containerSelector?: string;
  containerElement?: HTMLElement;
  nestedContainerRef?: ElementRef<HTMLElement>;
  pictureInPictureWindow?: Window;
  className?: string;
  children: VirtualElement;
  onAdopt?: NoneToVoidFunction;
};

const Portal = ({
  containerSelector, containerElement, nestedContainerRef, pictureInPictureWindow, className, children, onAdopt,
}: OwnProps) => {
  const inheritedWindow = useWindow();
  const inheritedContainer = useContext(PortalContainerContext);
  const [closedWindow, setClosedWindow] = useState<Window>();
  // A discarded picture-in-picture document has no window
  const destinationWindow = pictureInPictureWindow || containerElement?.ownerDocument.defaultView || inheritedWindow;
  const renderingWindow = destinationWindow === closedWindow || destinationWindow.closed ? window : destinationWindow;
  const destinationDocument = renderingWindow.document;
  // eslint-disable-next-line @eslint-react/purity
  const elementRef = useRef<HTMLDivElement>(document.createElement('div'));

  // Assigning the whole string also drops the classes of a previous value
  useLayoutEffect(() => {
    elementRef.current.className = buildClassName('Portal', className);
  }, [className]);

  // A new container adopts the element, so the content keeps its state
  useLayoutEffect(() => {
    const container = pictureInPictureWindow && destinationDocument !== document
      ? destinationDocument.body
      : containerElement || (!containerSelector ? inheritedContainer?.current : undefined)
        || destinationDocument.querySelector<HTMLElement>(containerSelector || '#portals')
        || (!containerSelector && destinationDocument !== document ? destinationDocument.body : undefined);

    if (!container) {
      return undefined;
    }

    const element = elementRef.current;
    let isCanceled = false;

    if (!element.parentElement) {
      container.appendChild(element);
      onAdopt?.();
    } else if (element.parentElement !== container) {
      // Transfers preserve scroll offsets even when adoption briefly removes the scroll boxes
      requestForcedReflow(() => {
        const positions = Array.from(element.querySelectorAll<HTMLElement>('*'))
          .filter((child) => child.scrollTop || child.scrollLeft)
          .map((child) => ({ child, top: child.scrollTop, left: child.scrollLeft }));

        return () => {
          if (isCanceled) return;
          container.appendChild(element);
          positions.forEach(({ child, top, left }) => {
            child.scrollTop = top;
            child.scrollLeft = left;
          });
          onAdopt?.();
        };
      });
    } else {
      onAdopt?.();
    }

    const releaseDelegation = destinationDocument !== document
      ? registerDelegatedDocument(destinationDocument) : undefined;
    const handlePageHide = () => setClosedWindow(destinationWindow);
    destinationWindow.addEventListener('pagehide', handlePageHide);

    return () => {
      isCanceled = true;
      releaseDelegation?.();
      destinationWindow.removeEventListener('pagehide', handlePageHide);
    };
  }, [containerSelector, containerElement, pictureInPictureWindow, destinationDocument, destinationWindow,
    inheritedContainer, onAdopt]);

  useLayoutEffect(() => {
    const element = elementRef.current;

    return () => {
      TeactDOM.render(undefined, element);
      element.remove();
    };
  }, []);

  const content = createElement(WindowContext.Provider, { value: renderingWindow },
    createElement(PortalContainerContext.Provider, {
      value: nestedContainerRef || inheritedContainer,
    }, children)) as VirtualElement;
  return TeactDOM.render(content, elementRef.current);
};

export default Portal;
