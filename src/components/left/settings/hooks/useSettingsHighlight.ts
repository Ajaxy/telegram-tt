import type { ElementRef } from '../../../../lib/teact/teact';
import { useEffect } from '../../../../lib/teact/teact';
import { addExtraClass, removeExtraClass } from '../../../../lib/teact/teact-dom';
import { getActions } from '../../../../global';

import type { SettingsHighlight } from '../../../../types';

import { DEBUG } from '../../../../config';
import { requestMeasure, requestMutation } from '../../../../lib/fasterdom/fasterdom';
import focusNoScroll from '../../../../util/focusNoScroll';

import useLang from '../../../../hooks/useLang';
import { useStateRef } from '../../../../hooks/useStateRef';

import { ACTIVE_SLIDE_CLASS_NAME, TO_SLIDE_CLASS_NAME } from '../../../ui/Transition';

const HIGHLIGHT_CLASS_NAME = 'settings-highlight';
const HIGHLIGHT_DURATION = 1800;
const WAIT_TIMEOUT = 3000;
const ANCHOR_ATTRIBUTE = 'data-settings-anchor';
const ROW_SELECTOR = '.ListItem, .Checkbox, .Radio, .MenuItem';
const FIELD_SELECTOR = '.input-group';
const FIELD_INPUT_SELECTOR = '.form-control';
const CONTROL_SELECTOR = `${ROW_SELECTOR}, ${FIELD_SELECTOR}`;
const SCROLL_CONTAINER_SELECTOR = '.custom-scroll';

export default function useSettingsHighlight(containerRef: ElementRef<HTMLDivElement>, highlight?: SettingsHighlight) {
  const { clearSettingsHighlight } = getActions();

  const lang = useLang();
  const langRef = useStateRef(lang);

  useEffect(() => {
    return () => {
      clearSettingsHighlight();
    };
  }, []);

  useEffect(() => {
    if (!highlight) return undefined;

    const { langKey } = highlight;
    const text = langRef.current(langKey);

    let observer: MutationObserver | undefined;
    let waitTimeout: number | undefined;
    let highlightTimeout: number | undefined;
    let highlightedElement: HTMLElement | undefined;
    let isCancelled = false;

    function stopWaiting() {
      observer?.disconnect();
      observer = undefined;
      window.clearTimeout(waitTimeout);
    }

    function removeHighlight() {
      const element = highlightedElement;
      if (!element) return;

      highlightedElement = undefined;
      requestMutation(() => {
        removeExtraClass(element, HIGHLIGHT_CLASS_NAME);
      });
    }

    function tryHighlight() {
      if (isCancelled) return;

      const slide = findCurrentSlide(containerRef.current!);
      if (!slide) return;

      const element = slide.querySelector<HTMLElement>(`[${ANCHOR_ATTRIBUTE}="${langKey}"]`)
        || findElementByText(slide, text);
      if (!element) {
        if (observer) return;

        observer = new MutationObserver(() => requestMeasure(tryHighlight));
        observer.observe(slide, { childList: true, subtree: true, characterData: true });
        waitTimeout = window.setTimeout(() => {
          stopWaiting();
          if (DEBUG) {
            // eslint-disable-next-line no-console
            console.warn('[Settings] Highlight target not found on screen', highlight);
          }
        }, WAIT_TIMEOUT);
        return;
      }

      stopWaiting();

      const field = element.closest(FIELD_SELECTOR)?.querySelector<HTMLElement>(FIELD_INPUT_SELECTOR) || undefined;
      const anchor = field || element.closest<HTMLElement>(ROW_SELECTOR) || element;
      const scrollContainer = anchor.closest<HTMLElement>(SCROLL_CONTAINER_SELECTOR);
      const scrollTop = scrollContainer && getCenteredScrollTop(scrollContainer, anchor);

      requestMutation(() => {
        if (isCancelled) return;

        if (scrollContainer) scrollContainer.scrollTop = scrollTop!;

        if (field) {
          focusNoScroll(field);
          return;
        }

        highlightedElement = anchor;
        addExtraClass(anchor, HIGHLIGHT_CLASS_NAME);
        highlightTimeout = window.setTimeout(removeHighlight, HIGHLIGHT_DURATION);
      });
    }

    requestMeasure(tryHighlight);

    return () => {
      isCancelled = true;
      stopWaiting();
      window.clearTimeout(highlightTimeout);
      removeHighlight();
    };
  }, [containerRef, highlight, langRef]);
}

function findCurrentSlide(container: HTMLElement) {
  const slides = Array.from(container.children) as HTMLElement[];

  return slides.find((slide) => slide.classList.contains(TO_SLIDE_CLASS_NAME))
    || slides.find((slide) => slide.classList.contains(ACTIVE_SLIDE_CLASS_NAME));
}

function findElementByText(root: HTMLElement, text: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let firstElement: HTMLElement | undefined;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeValue?.trim() !== text) continue;

    const element = node.parentElement!;
    if (element.closest(CONTROL_SELECTOR)) return element;

    if (!firstElement) firstElement = element;
  }

  return firstElement;
}

function getCenteredScrollTop(scrollContainer: HTMLElement, anchor: HTMLElement) {
  const containerRect = scrollContainer.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const offset = anchorRect.top - containerRect.top - (containerRect.height - anchorRect.height) / 2;

  return scrollContainer.scrollTop + offset;
}
