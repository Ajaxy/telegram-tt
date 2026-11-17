import { setExtraStyles } from '../../../lib/teact/teact-dom';

import {
  forceMutation, requestForcedReflow, requestMeasure,
} from '../../../lib/fasterdom/fasterdom';
import { isAnimatingScroll } from '../../../util/animateScroll';
import { AT_BOTTOM_THRESHOLD, getMessageListTopReserve } from './messageListReserves';

type ResizeAnchor = 'top' | 'bottom';

const pendingResizes = new WeakMap<HTMLElement, { height: number; anchor: ResizeAnchor }>();
const handledGrowthByContainer = new WeakMap<Element, number>();

export function resizeMessageWidget(element: HTMLElement, height: number, anchor: ResizeAnchor) {
  const isPending = pendingResizes.has(element);
  pendingResizes.set(element, { height, anchor });
  if (isPending) return;

  // Native scroll anchoring and the list's bottom alignment affect the edge after the height write. The height is an extra
  // style, which a render of the widget's own style keeps: it wiped a plain one, and the jump went uncompensated
  requestForcedReflow(() => {
    const resize = pendingResizes.get(element)!;
    pendingResizes.delete(element);
    if (!element.isConnected) return;
    if (element.style.height === `${resize.height}px`) return;

    const scroller = element.closest<HTMLElement>('.MessageList');
    const content = element.closest<HTMLElement>('.messages-container');
    if (!scroller || !content || isAnimatingScroll(scroller)) {
      forceMutation(() => {
        setExtraStyles(element, { height: `${resize.height}px` });
      }, element);
      return;
    }

    const rect = element.getBoundingClientRect();
    const viewport = scroller.getBoundingClientRect();
    const contentHeight = content.getBoundingClientRect().height;
    const wasAtBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <= AT_BOTTOM_THRESHOLD;
    const wasAboveViewport = rect.bottom <= viewport.top + getMessageListTopReserve(scroller);
    const edge = wasAtBottom || wasAboveViewport ? 'bottom' : resize.anchor;
    const shouldKeepEdge = wasAtBottom || rect.top < viewport.bottom;

    forceMutation(() => {
      setExtraStyles(element, { height: `${resize.height}px` });
    }, element);

    const growth = content.getBoundingClientRect().height - contentHeight;
    const edgeOffset = shouldKeepEdge ? element.getBoundingClientRect()[edge] - rect[edge] : 0;
    const scrollTop = scroller.scrollTop;
    if (edgeOffset) {
      forceMutation(() => {
        scroller.scrollTop = scrollTop + edgeOffset;
      }, scroller);
    }

    const pendingGrowth = (handledGrowthByContainer.get(content) || 0) + growth;
    if (pendingGrowth) {
      handledGrowthByContainer.set(content, pendingGrowth);
      // Opposing layout changes can cancel this resize and suppress its observer notification
      requestMeasure(() => {
        handledGrowthByContainer.delete(content);
      });
    } else {
      handledGrowthByContainer.delete(content);
    }
  });
}

export function consumeMessageWidgetResize(content: Element) {
  const growth = handledGrowthByContainer.get(content) || 0;
  handledGrowthByContainer.delete(content);
  return growth;
}
