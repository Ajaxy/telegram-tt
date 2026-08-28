import { useEffect } from '@teact';

import { requestMutation } from '../lib/fasterdom/fasterdom';
import useLastCallback from './useLastCallback';

const FILE_DRAG_TYPE = 'Files';
const FILE_HOVER_OPEN_EVENT = 'filehoveropen';
export const FILE_HOVER_OPEN_SELECTOR = '[data-file-hover-open]';
const DROP_ZONE_SELECTOR = '[data-dropzone]';
const FILE_HOVER_OPEN_ACTIVE_ATTRIBUTE = 'data-file-hover-open-active';

const FILE_HOVER_OPEN_DELAY_MS = 750;
const FILE_DRAG_SESSION_GAP_MS = 1000;
const FILE_HOVER_REARM_DISTANCE_PX = 4;

export default function useFileHoverOpen() {
  useEffect(() => {
    let candidateElement: HTMLElement | undefined;
    let candidateStartedAt = 0;
    let lastDragEventAt = 0;
    let activationPoint: { x: number; y: number } | undefined;

    function setCandidate(nextElement?: HTMLElement, startedAt = 0) {
      if (candidateElement === nextElement) return;

      const previousElement = candidateElement;
      candidateElement = nextElement;
      candidateStartedAt = startedAt;

      requestMutation(() => {
        previousElement?.removeAttribute(FILE_HOVER_OPEN_ACTIVE_ATTRIBUTE);
        if (nextElement && candidateElement === nextElement) {
          nextElement.setAttribute(FILE_HOVER_OPEN_ACTIVE_ATTRIBUTE, '');
        }
      });
    }

    function resetCandidate() {
      setCandidate(undefined);
    }

    function resetState() {
      resetCandidate();
      lastDragEventAt = 0;
      activationPoint = undefined;
    }

    function handleDragPosition(e: DragEvent) {
      if (!hasFiles(e.dataTransfer)) {
        resetState();
        return;
      }

      const currentTime = performance.now();
      if (lastDragEventAt && currentTime - lastDragEventAt > FILE_DRAG_SESSION_GAP_MS) {
        resetState();
      }
      lastDragEventAt = currentTime;

      if (activationPoint) {
        const distance = Math.hypot(e.clientX - activationPoint.x, e.clientY - activationPoint.y);
        if (distance < FILE_HOVER_REARM_DISTANCE_PX) return;

        activationPoint = undefined;
        resetCandidate();
      }

      const target = findTarget(e.target);
      if (!target) {
        resetCandidate();
        return;
      }

      if (target !== candidateElement) {
        setCandidate(target, currentTime);
        return;
      }

      if (currentTime - candidateStartedAt < FILE_HOVER_OPEN_DELAY_MS) return;

      activationPoint = { x: e.clientX, y: e.clientY };
      resetCandidate();
      target.dispatchEvent(new CustomEvent(FILE_HOVER_OPEN_EVENT, { bubbles: true }));
    }

    function handleDragLeave(e: DragEvent) {
      if (!e.relatedTarget) {
        if (isOutsideViewport(e)) {
          resetState();
        } else {
          resetCandidate();
        }
        return;
      }

      if (findTarget(e.target) !== findTarget(e.relatedTarget)) {
        resetCandidate();
      }
    }

    document.addEventListener('dragenter', handleDragPosition, true);
    document.addEventListener('dragover', handleDragPosition, true);
    document.addEventListener('dragleave', handleDragLeave, true);
    document.addEventListener('drop', resetState, true);
    document.addEventListener('dragend', resetState, true);
    window.addEventListener('blur', resetState);
    window.addEventListener('pagehide', resetState);

    return () => {
      document.removeEventListener('dragenter', handleDragPosition, true);
      document.removeEventListener('dragover', handleDragPosition, true);
      document.removeEventListener('dragleave', handleDragLeave, true);
      document.removeEventListener('drop', resetState, true);
      document.removeEventListener('dragend', resetState, true);
      window.removeEventListener('blur', resetState);
      window.removeEventListener('pagehide', resetState);
      resetState();
    };
  }, []);
}

export function useFileHoverOpenHandler(onFileHoverOpen?: NoneToVoidFunction) {
  return useLastCallback((e: Event) => {
    handleFileHoverOpenEvent(e, onFileHoverOpen!);
  });
}

export function handleFileHoverOpenEvent(e: Event, onFileHoverOpen: NoneToVoidFunction) {
  e.stopPropagation();
  onFileHoverOpen();
}

export function hasFiles(dataTransfer: DataTransfer | null) {
  return Boolean(dataTransfer && Array.from(dataTransfer.types).includes(FILE_DRAG_TYPE));
}

function findTarget(eventTarget: EventTarget | null) {
  if (!(eventTarget instanceof Element) || eventTarget.closest(DROP_ZONE_SELECTOR)) return undefined;

  return eventTarget.closest<HTMLElement>(FILE_HOVER_OPEN_SELECTOR) || undefined;
}

function isOutsideViewport(e: DragEvent) {
  return e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight;
}
