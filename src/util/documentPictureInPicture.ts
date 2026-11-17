import preloadFonts from './fonts';

import Deferred from './Deferred';

export type DocumentPictureInPictureOwner = {
  id: string;
  onWindowChange: (pictureInPictureWindow?: Window) => void;
  onError: NoneToVoidFunction;
};

type PictureInPictureSession = {
  owner: DocumentPictureInPictureOwner;
  pictureInPictureWindow?: Window;
  cleanup?: NoneToVoidFunction;
};

const VIEWPORT_HEIGHT_PERCENT = 0.01;
const MIRRORED_ATTRIBUTES = ['class', 'style', 'lang', 'dir'];
const MAIN_DOCUMENT_CLASSES = ['has-open-dialog', 'in-background', 'cursor-grabbing', 'cursor-ew-resize'];
const STYLESHEET_SELECTOR = 'style, link[rel~="stylesheet"], link[rel="preload"][as="font"]';

let activeSession: PictureInPictureSession | undefined;
const discardedWindows = new Set<Window>();

export function focusDocumentPictureInPicture(ownerId: string) {
  const pictureInPictureWindow = activeSession?.pictureInPictureWindow;
  if (activeSession?.owner.id !== ownerId || !pictureInPictureWindow || pictureInPictureWindow.closed) return false;

  pictureInPictureWindow.focus();
  return true;
}

export function requestDocumentPictureInPicture(
  owner: DocumentPictureInPictureOwner,
  options?: DocumentPictureInPictureOptions,
) {
  if (activeSession?.owner === owner) {
    activeSession.pictureInPictureWindow?.focus();
    return;
  }

  if (activeSession) releaseSession(activeSession);

  const session: PictureInPictureSession = { owner };
  activeSession = session;
  const backgroundColor = getPageBackgroundColor();

  try {
    // Keep the native request inside the originating user gesture
    const api = window.documentPictureInPicture!;
    const previousWindow = api.window;
    const opening = api.requestWindow(options);
    const openingWindow = api.window;
    if (openingWindow && openingWindow !== previousWindow) {
      // Paint immediately when the browser exposes the window before its promise settles
      openingWindow.document.documentElement.style.backgroundColor = backgroundColor;
    }

    void opening.then(async (pictureInPictureWindow) => {
      if (activeSession !== session) {
        discardedWindows.add(pictureInPictureWindow);
        closeDiscardedWindows();
        return;
      }

      session.pictureInPictureWindow = pictureInPictureWindow;
      if (pictureInPictureWindow.closed) {
        releaseSession(session);
        return;
      }

      const { cleanup, ready } = mirrorDocument(pictureInPictureWindow, backgroundColor);
      const handlePageHide = () => releaseSession(session, true);
      pictureInPictureWindow.addEventListener('pagehide', handlePageHide);
      session.cleanup = () => {
        cleanup();
        pictureInPictureWindow.removeEventListener('pagehide', handlePageHide);
      };
      closeDiscardedWindows();

      await ready;
      if (activeSession !== session || session.pictureInPictureWindow !== pictureInPictureWindow) return;
      if (pictureInPictureWindow.closed) {
        releaseSession(session);
        return;
      }

      owner.onWindowChange(pictureInPictureWindow);
    }).catch(() => handleRequestError(session));
  } catch {
    handleRequestError(session);
  }
}

export function closeDocumentPictureInPicture(owner: DocumentPictureInPictureOwner) {
  if (activeSession?.owner !== owner) return;

  releaseSession(activeSession);
}

function releaseSession(session: PictureInPictureSession, noCloseWindow?: boolean) {
  if (activeSession !== session) return;

  activeSession = undefined;
  session.cleanup?.();
  session.owner.onWindowChange(undefined);
  if (!noCloseWindow) session.pictureInPictureWindow?.close();
  closeDiscardedWindows();
}

function handleRequestError(session: PictureInPictureSession) {
  if (activeSession !== session) return;

  releaseSession(session);
  session.owner.onError();
}

function closeDiscardedWindows() {
  // A pending newer request can resolve to the same native window
  if (activeSession && !activeSession.pictureInPictureWindow) return;

  discardedWindows.forEach((pictureInPictureWindow) => {
    if (pictureInPictureWindow !== activeSession?.pictureInPictureWindow) pictureInPictureWindow.close();
  });
  discardedWindows.clear();
}

function mirrorDocument(pictureInPictureWindow: Window, backgroundColor: string) {
  const pictureInPictureDocument = pictureInPictureWindow.document;
  const stylesReady = new Deferred();
  const released = new Deferred();
  const stylesheetNodes = new Map<Element, Node>();
  const pendingStylesheetLinks = new Map<HTMLLinkElement, (event: Event) => void>();
  const mirroredClasses = new Map<HTMLElement, string[]>();
  let isReleased = false;

  function syncStylesheets() {
    const sources = Array.from(document.querySelectorAll(STYLESHEET_SELECTOR));
    stylesheetNodes.forEach((node, source) => {
      if (sources.includes(source) && source.isEqualNode(node)) return;

      if (node instanceof HTMLLinkElement) clearPendingStylesheetLink(node);
      node.parentNode?.removeChild(node);
      stylesheetNodes.delete(source);
    });
    let previousNode: Node | undefined;
    sources.forEach((source) => {
      const nextSibling = previousNode ? previousNode.nextSibling : pictureInPictureDocument.head.firstChild;
      const existingNode = stylesheetNodes.get(source);
      if (existingNode) {
        if (nextSibling !== existingNode) {
          pictureInPictureDocument.head.insertBefore(existingNode, nextSibling);
        }
        previousNode = existingNode;
        return;
      }

      const node = source.cloneNode(true);
      if (node instanceof HTMLLinkElement && node.relList.contains('stylesheet') && !node.disabled) {
        const handleLoad = (event: Event) => {
          if (!pendingStylesheetLinks.has(node)) return;
          clearPendingStylesheetLink(node);

          if (!source.isConnected || !source.isEqualNode(node)) {
            syncStylesheets();
          } else if (event.type === 'error') {
            stylesReady.reject(new Error('Failed to load picture-in-picture styles'));
          } else if (!pendingStylesheetLinks.size) {
            stylesReady.resolve();
          }
        };
        pendingStylesheetLinks.set(node, handleLoad);
        node.addEventListener('load', handleLoad);
        node.addEventListener('error', handleLoad);
      }
      stylesheetNodes.set(source, node);
      pictureInPictureDocument.head.insertBefore(node, nextSibling);
      previousNode = node;
    });
    pictureInPictureDocument.title = document.title;
    if (!pendingStylesheetLinks.size) stylesReady.resolve();
  }

  function clearPendingStylesheetLink(link: HTMLLinkElement) {
    const handleLoad = pendingStylesheetLinks.get(link);
    if (!handleLoad) return;

    link.removeEventListener('load', handleLoad);
    link.removeEventListener('error', handleLoad);
    pendingStylesheetLinks.delete(link);
  }

  function syncAttributes() {
    [document.documentElement, document.body].forEach((source, index) => {
      const target = index ? pictureInPictureDocument.body : pictureInPictureDocument.documentElement;
      MIRRORED_ATTRIBUTES.forEach((name) => {
        if (name === 'class') return;

        const value = source.getAttribute(name) ?? undefined;
        if (value !== undefined) target.setAttribute(name, value);
        else target.removeAttribute(name);
      });
      target.classList.remove(...(mirroredClasses.get(target) || []));
      const classNames = Array.from(source.classList).filter((name) => !MAIN_DOCUMENT_CLASSES.includes(name));
      target.classList.add(...classNames);
      mirroredClasses.set(target, classNames);
      target.style.removeProperty('pointer-events');
      target.style.setProperty('--vh', `${pictureInPictureWindow.innerHeight * VIEWPORT_HEIGHT_PERCENT}px`);
      // The copied body style carries the default wallpaper color instead of the current chat's one
      target.style.backgroundColor = backgroundColor;
    });
  }

  const stylesheetObserver = new MutationObserver(syncStylesheets);
  const attributeObserver = new MutationObserver(syncAttributes);
  [document.documentElement, document.body].forEach((element) => {
    attributeObserver.observe(element, { attributes: true, attributeFilter: MIRRORED_ATTRIBUTES });
  });
  pictureInPictureWindow.addEventListener('resize', syncAttributes);
  syncAttributes();
  // Give the green canvas a rendering opportunity before copying all app styles
  let initializationFrame = pictureInPictureWindow.requestAnimationFrame(() => {
    initializationFrame = pictureInPictureWindow.requestAnimationFrame(() => {
      try {
        syncStylesheets();
        stylesheetObserver.observe(document.head, {
          childList: true, subtree: true, attributes: true, characterData: true,
        });
      } catch (err) {
        stylesReady.reject(err);
      }
    });
  });

  return {
    ready: Promise.race([
      stylesReady.promise.then(async () => {
        if (isReleased) return;
        await preloadFonts(pictureInPictureDocument);
      }),
      released.promise,
    ]),
    cleanup: () => {
      isReleased = true;
      pictureInPictureWindow.cancelAnimationFrame(initializationFrame);
      released.resolve();
      pendingStylesheetLinks.forEach((_, link) => clearPendingStylesheetLink(link));
      stylesReady.resolve();
      stylesheetObserver.disconnect();
      attributeObserver.disconnect();
      pictureInPictureWindow.removeEventListener('resize', syncAttributes);
    },
  };
}

function getPageBackgroundColor() {
  // A chat wallpaper overrides the default page color on `#Main`
  const pageElement = document.getElementById('Main') || document.body;
  return getComputedStyle(pageElement).getPropertyValue('--theme-background-color');
}
