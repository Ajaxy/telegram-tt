import {
  memo, onFullyIdle, useEffect, useRef, useState,
} from '../../../lib/teact/teact';
import {
  getActions, getGlobal, getPromiseActions, withGlobal,
} from '../../../global';

import type { ApiMessage, ApiUser } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type {
  BubbleGesture, ContentSafeArea, WalletCall, WidgetAction, WidgetHost, WidgetRequest, WidgetRequestAnswer,
  WidgetTheme, WidgetViewer,
} from '../../../lib/widget-sandbox';
import type { IThemeSettings, ThemeKey } from '../../../types';
import type { LangFn } from '../../../util/localization';

import { EDITABLE_INPUT_ID } from '../../../config';
import {
  buildColor, convertColor, mixColors, serializeColor,
} from '../../../lib/color';
import { forceMutation, requestForcedReflow, requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { forceUpdateCache } from '../../../global/cache';
import {
  getMainUsername, getUserFullName,
} from '../../../global/helpers';
import {
  selectCanAnimateInterface, selectChat, selectIsWalletAvailable, selectMessageWidgetHeight, selectMessageWidgetStorage,
  selectUser, selectUserFullInfo, selectWidgetBotId, selectWidgetChatType,
} from '../../../global/selectors';
import { selectSharedSettings } from '../../../global/selectors/sharedState';
import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { bufferToHex } from '../../../util/encoding/buffer';
import { isLocalMessageId } from '../../../util/keys/messageKey';
import loadWidgetSandbox from '../../../util/loadWidgetSandbox';
import trimText from '../../../util/text/trimText';
import { extractCurrentThemeParams, prepareHexColor } from '../../../util/themeStyle';
import {
  bindWidgetStorage, getWidgetStorageKey, moveWidgetStorage, widgetSessionStorages, widgetTransientLocalStorages,
} from '../../../util/widgetStorage';
import { registerWidgetWalletCall } from '../../../util/widgetWalletCalls';
import { callApi } from '../../../api/gramjs';
import { REM } from '../../common/helpers/mediaDimensions';
import { resizeMessageWidget } from '../helpers/messageWidgetResize';

import useForceUpdate from '../../../hooks/useForceUpdate';
import { useIsIntersecting } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import { useStateRef } from '../../../hooks/useStateRef';
import useWidgetPublicDataPolling from './hooks/useWidgetPublicDataPolling';

import styles from './Widget.module.scss';

type OwnProps = {
  message: ApiMessage;
  theme: ThemeKey;
  isInSelectMode?: boolean;
  isProtected?: boolean;
  isActive?: boolean;
  canReply?: boolean;
  hasHeader?: boolean;
  hasTimeOverlay?: boolean;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  // Not sent yet: no input, no requests and no storage (widget-sandbox sdk-v1 §2.16)
  isPreview?: boolean;
};

type StateProps = {
  accountId?: string;
  areWidgetsDisabled?: boolean;
  isLocked?: boolean;
  themeSettings?: IThemeSettings;
  messageTextSize: number;
  isWalletAvailable?: boolean;
};

export const MIN_WIDTH = 200;
export const FEATURES = ['webAnimations'];
const MAX_SAFE_AREA_INSET = 64;
const MAX_SAFE_AREA_CORNER = 200;
const MAX_COPIED_TEXT_LENGTH = 100;
// The renderer's events are composed: a press the widget or the renderer's bubble owns stays out of the message's
// handlers. Touches, pointers, selection and drags stop at the mount, since the message's recognizers (swipe, long
// press) listen for them natively; mouse events go on to the page's own listeners (an open menu closes on a press in the
// widget) and only the message's Teact handlers skip them (`skipWidgetEvent`)
const CONTAINED_EVENTS = [
  'pointerdown', 'pointerup', 'pointercancel', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'selectstart',
  'dragstart',
];
const MOUSE_EVENTS = ['mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu'];
const WIDGET_EVENT_MARK = 'isWidgetEvent';
// Heights reach the global state (and the cache) once a resize settles: an animated widget resizes every frame
const HEIGHT_COMMIT_DELAY = 500;
export const MIN_HEIGHT = 50;
// Most widgets are taller than the minimum, so the list moves less when the first render replaces the placeholder
export const PLACEHOLDER_HEIGHT = 160;
export const MAX_HEIGHT = 600;
const MAX_FAILURES = 2;
const TEXT_LINE_HEIGHT = 1.3125;
const BUTTON_FONT = '500 14px/1.2 system-ui, sans-serif';
// Rec. 709 luma, enough to tell a dark fill from a light one
const LUMA_WEIGHTS = [0.2126, 0.7152, 0.0722];
const DARK_LUMINANCE = 0.5;
const WHITE = '#ffffff';
const BLACK = '#000000';
// A storage commit comes after every task that changed it; the local area is written once it settles
const LOCAL_COMMIT_DELAY = 1000;
const widgetFailures = new Map<string, { hash: string; count: number }>();
// Each runtime holds a worker and tens of megabytes; off screen only this many run, on screen every widget does
const MAX_OFFSCREEN_RUNTIMES = 8;
const liveRuntimes = new Set<symbol>();
const runtimeSlotListeners = new Set<NoneToVoidFunction>();

function releaseRuntime(runtime: symbol) {
  if (!liveRuntimes.delete(runtime)) return;
  runtimeSlotListeners.forEach((listener) => listener());
}
let failureAccountId: string | undefined;
// The runtime's layout queries wait through JavaScript Promise Integration: no cross-origin isolation is needed
export const IS_SUPPORTED = typeof Worker === 'function' && typeof WebAssembly === 'object'
  && typeof (WebAssembly as { Suspending?: unknown }).Suspending === 'function';

function Widget({
  message, theme, isInSelectMode, isProtected, isActive, canReply, hasHeader, hasTimeOverlay,
  observeIntersectionForLoading, observeIntersectionForPlaying, isPreview,
  accountId, areWidgetsDisabled, isLocked, themeSettings, messageTextSize, isWalletAvailable,
}: OwnProps & StateProps) {
  const {
    setMessageWidgetHeight, toggleSafeLinkModal, updateDraftReplyInfo, openPreviousChat,
    openTelegramLink, showNotification, openWidgetWalletCall, markMessageWidgetSeen,
  } = getActions();
  const lang = useLang();
  const { chatId, id: messageId } = message;
  // Scheduled and ephemeral messages number their ids apart from the chat's history: their state stays in memory
  const isTransient = Boolean(message.isScheduled || message.isEphemeral);
  const storageKey = getWidgetStorageKey(
    chatId, messageId, message.isScheduled ? 'scheduled' : message.isEphemeral ? 'ephemeral' : undefined,
  );
  // The bubble stays when the server's id replaces a sent message's local one: what its widget keeps in memory follows,
  // in every tab that shows it (iOS does the same)
  const storageKeyRef = useRef(storageKey);
  if (storageKeyRef.current !== storageKey) {
    moveWidgetStorage(storageKeyRef.current, storageKey);
    storageKeyRef.current = storageKey;
  }
  const widget = message.content.widget!;
  const {
    html, width, height, chatData, publicData, widgetId,
  } = widget;
  const rootRef = useRef<HTMLDivElement>();
  const mountRef = useRef<HTMLDivElement>();
  const hostRef = useRef<WidgetHost>();
  // The last run of a widget that left the viewport: its worker is gone, its render stays as a picture until a new run
  // loads, so the bubble does not fall back to the placeholder
  const pictureRef = useRef<WidgetHost>();
  // The height of the last run, kept with the message, so the bubble opens at its size and the list does not jump
  const cachedHeightRef = useRef(!isTransient ? selectMessageWidgetHeight(getGlobal(), chatId, messageId) : undefined);
  // A widget that cannot run keeps one line for its text, whatever size the bot gave it
  const canRun = IS_SUPPORTED && !areWidgetsDisabled && Boolean(html);
  const naturalHeightRef = useRef(canRun ? cachedHeightRef.current?.height ?? PLACEHOLDER_HEIGHT : MIN_HEIGHT);
  const pendingLocalStorageRef = useRef<Record<string, string>>();
  const localCommitTimeoutRef = useRef<number>();
  // A cleared storage starts the run again, and what the old one commits after that is dropped
  const [storageEpoch, setStorageEpoch] = useState(0);
  const storageEpochRef = useRef(0);
  const pendingHeightRef = useRef<{ height: number; anchor: 'top' | 'bottom' }>();
  const heightCommitTimeoutRef = useRef<number>();
  const [isDocumentVisible, setIsDocumentVisible] = useState(!document.hidden);
  const [hasRuntime, setHasRuntime] = useState(false);
  const [hasPicture, setHasPicture] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [isWatchingPublicData, setIsWatchingPublicData] = useState(false);
  const isNearViewport = useIsIntersecting(rootRef, observeIntersectionForLoading);
  const isOnScreen = useIsIntersecting(rootRef, observeIntersectionForPlaying);
  const isOnScreenRef = useStateRef(isOnScreen);
  // A widget the cap kept from starting tries again when a slot is freed or it comes on screen; only then does this
  // change, so a widget with a runtime never restarts for it
  const [slotRetry, setSlotRetry] = useState(0);
  const isWaitingForSlotRef = useRef(false);
  const isVisible = isDocumentVisible && isOnScreen && isActive !== false && !isLocked;
  // A message not sent yet, a scheduled or an ephemeral one is not on the server: there is nothing to ask the bot about
  const isServerMessage = !isLocalMessageId(messageId) && !isTransient;
  const canQuery = isServerMessage && Boolean(widget.canQuery);
  const canBackgroundQuery = isServerMessage && Boolean(widget.canBackgroundQuery);
  const isCopy = Boolean(widget.isCopy);
  // A hidden document only pauses the widget through `setVisible`, so its last render stays
  const forceUpdate = useForceUpdate();
  const runtimeRef = useRef<symbol>();
  // A right click the bubble took: the browser's own `contextmenu` follows, when the platform opens menus (on Windows
  // at the release), and opens the message's menu
  const isMenuClickRef = useRef(false);
  const hasRuntimeSlot = isOnScreen || Boolean(runtimeRef.current) || liveRuntimes.size < MAX_OFFSCREEN_RUNTIMES;
  const canStart = IS_SUPPORTED && !areWidgetsDisabled && isNearViewport && hasRuntimeSlot && isActive !== false
    && !isLocked;
  useWidgetPublicDataPolling({
    widgetId: isServerMessage ? widgetId : undefined, chatId, messageId, isVisible, isWatching: isWatchingPublicData,
  });

  const fixedHeight = height && canRun ? Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)) : undefined;

  const commitLocalStorage = useLastCallback(() => {
    clearTimeout(localCommitTimeoutRef.current);
    localCommitTimeoutRef.current = undefined;
    const values = pendingLocalStorageRef.current;
    if (!values) return undefined;

    pendingLocalStorageRef.current = undefined;
    if (isTransient) {
      widgetTransientLocalStorages.set(storageKey, values);
      return undefined;
    }
    return getPromiseActions().setMessageWidgetStorage({
      accountId: accountId!, chatId, messageId, area: 'local', values,
    });
  });

  // On hide, close and a crash the latest local area goes to disk at once, once the state has it
  const flushStorage = useLastCallback(() => {
    void commitLocalStorage()?.then(forceUpdateCache);
  });

  const resetStorage = useLastCallback(() => {
    clearTimeout(localCommitTimeoutRef.current);
    localCommitTimeoutRef.current = undefined;
    pendingLocalStorageRef.current = undefined;
    setStorageEpoch(++storageEpochRef.current);
  });

  useEffect(() => bindWidgetStorage({ flush: flushStorage, reset: resetStorage }), [flushStorage, resetStorage]);

  const updateTheme = useLastCallback(() => {
    requestMeasure(() => {
      const root = rootRef.current;
      const host = hostRef.current;
      if (!root || !host) return;
      // The renderer applies this synchronously and reads layout while doing so
      host.setTheme(buildWidgetTheme(root, theme));
    });
  });

  const handleBubbleGesture = useLastCallback((gesture: BubbleGesture) => {
    if (!isVisible || isInSelectMode) return;
    const root = rootRef.current!;
    if (gesture.action === 'menu' && gesture.phase === 'start' && gesture.gesture === 'menu-click') {
      isMenuClickRef.current = true;
    } else if (gesture.action === 'menu' && gesture.phase === 'start') {
      requestMeasure(() => {
        const rect = root.getBoundingClientRect();
        root.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true, clientX: rect.left + gesture.x, clientY: rect.top + gesture.y,
        }));
      });
    } else if (gesture.phase === 'end' && gesture.action === 'swipe' && gesture.deltaX < 0 && canReply) {
      updateDraftReplyInfo(message.isEphemeral ? { type: 'ephemeral', replyToMsgId: messageId } : {
        replyToMsgId: messageId,
        replyToPeerId: undefined,
        quoteText: undefined,
        quoteRich: undefined,
        quoteOffset: undefined,
      });
    } else if (gesture.phase === 'end' && gesture.action === 'back'
      && (lang.isRtl ? gesture.deltaX < 0 : gesture.deltaX > 0)) {
      openPreviousChat();
    }
  });

  const handleAction = useLastCallback((action: WidgetAction) => {
    const global = getGlobal();
    if (!isVisible || isInSelectMode || global.currentUserId !== accountId || global.passcode.isScreenLocked) return;
    // One dialog at a time: a link that arrives while one is shown is dropped. Web ignores haptics.
    if (document.querySelector('.Modal')) return;
    if (action.kind === 'openLink') {
      toggleSafeLinkModal({ url: action.url, isWidget: true });
    } else if (action.kind === 'openTelegramLink') {
      openTelegramLink({ url: action.url });
    }
  });

  const handleRequest = useLastCallback(async ({ data, wallet }: WidgetRequest): Promise<WidgetRequestAnswer> => {
    const global = getGlobal();
    const chat = selectChat(global, chatId);
    if (!chat || isInSelectMode || global.currentUserId !== accountId || global.passcode.isScreenLocked) {
      return Promise.reject();
    }

    const answer = await callApi('fetchBotWidgetQueryAnswer', { chat, messageId, data, withWallet: wallet });
    if (!answer || answer.error) return Promise.reject(answer?.error);
    return { result: answer.result };
  });

  // The framework let the call through on a tap or its grant; the client's wallet window asks the user
  const handleWallet = useLastCallback((call: WalletCall): Promise<WidgetRequestAnswer> => {
    const global = getGlobal();
    const botId = selectWidgetBotId(global, message);
    if (!botId || global.currentUserId !== accountId || global.passcode.isScreenLocked) return Promise.reject();

    return new Promise((resolve, reject) => {
      const callId = registerWidgetWalletCall((outcome) => {
        if (outcome.error) reject(outcome.error);
        else resolve({ result: outcome.result });
      });
      openWidgetWalletCall({
        callId,
        botId,
        chatId,
        messageId,
        call: {
          method: call.method,
          params: call.method === 'signData' ? call.payload : call.transaction,
          data: call.data,
        },
      });
    });
  });

  const handleCopyText = useLastCallback((text: string) => {
    const global = getGlobal();
    if (global.currentUserId !== accountId || isInSelectMode) return;
    // Where the chat forbids copying, as for its text selection, nothing is copied and the chat says why
    if (isProtected) {
      showNotification({ message: getCopyProtectionInfo(global, lang, chatId) });
      return;
    }
    // Copied outside the press's handler, the browser may refuse it: then nothing says it was copied
    if (!copyTextToClipboard(text)) return;
    // Shown as copied: no entities, so none of its characters are read as formatting or links
    showNotification({
      message: lang('ExactTextCopied', { text: trimText(text, MAX_COPIED_TEXT_LENGTH) }), messageEntities: [],
    });
  });

  const updateSafeArea = useLastCallback(() => {
    requestMeasure(() => {
      const root = rootRef.current;
      const host = hostRef.current;
      if (!root || !host) return;
      const safeArea = measureSafeArea(root);
      const current = host.contentSafeArea;
      if (current.bottom === (safeArea.bottom || 0) && current.cornerLeft === (safeArea.cornerLeft || 0)
        && current.cornerRight === (safeArea.cornerRight || 0)) return;
      host.setContentSafeArea(safeArea);
    });
  });

  const commitHeight = useLastCallback(() => {
    clearTimeout(heightCommitTimeoutRef.current);
    heightCommitTimeoutRef.current = undefined;
    const pending = pendingHeightRef.current;
    if (!pending) return;
    pendingHeightRef.current = undefined;
    setMessageWidgetHeight({
      accountId: accountId!, chatId, messageId, height: pending.height, resizeAnchor: pending.anchor,
    });
  });

  const handleResize = useLastCallback((newHeight: number, anchor: 'top' | 'bottom') => {
    naturalHeightRef.current = newHeight;
    if (!isTransient && !isPreview) {
      pendingHeightRef.current = { height: newHeight, anchor };
      clearTimeout(heightCommitTimeoutRef.current);
      heightCommitTimeoutRef.current = window.setTimeout(commitHeight, HEIGHT_COMMIT_DELAY);
    }
    resizeMessageWidget(rootRef.current!, fixedHeight || newHeight, anchor);
  });

  const createHost = useLastCallback((
    Runtime: typeof WidgetHost, content: string, getIsCancelled: () => boolean, onDead: NoneToVoidFunction,
    onReady: NoneToVoidFunction,
  ) => {
    const root = rootRef.current!;
    const mount = mountRef.current!;
    const widgetTheme = buildWidgetTheme(root, theme);
    // An area that is not there is empty: an undefined one makes the host refuse the whole preload
    const storage = isPreview ? { local: {}, session: {} } : {
      local: (isTransient
        ? widgetTransientLocalStorages.get(storageKey)
        : selectMessageWidgetStorage(getGlobal(), chatId, messageId)?.local) ?? {},
      session: widgetSessionStorages.get(storageKey) ?? {},
    };
    const epoch = storageEpochRef.current;
    const global = getGlobal();
    const contentSafeArea = hasTimeOverlay ? measureSafeArea(root) : undefined;
    // The renderer measures its still empty document until the sandbox has booted
    let isLoaded = false;
    let pendingResize: [number, 'top' | 'bottom'] | undefined;
    let host: WidgetHost;
    // The library appends its shadow host and synchronously measures the initial viewport
    forceMutation(() => {
      host = new Runtime(mount, content, {
        theme: widgetTheme,
        locale: lang.code,
        storage,
        contentSafeArea,
        features: FEATURES,
        data: { chatData: chatData || undefined, publicData: publicData || undefined },
        context: {
          preview: isPreview,
          isCopy,
          canQuery,
          backgroundQuery: canBackgroundQuery,
          chatType: selectWidgetChatType(global, chatId),
          viewer: canQuery ? buildWidgetViewer(selectUser(global, global.currentUserId!)) : undefined,
          wallet: isWalletAvailable,
        },
        // Select mode only blocks input (the mount takes no pointer events); the widget keeps running
        visible: isVisible,
        isProtected,
        // The app's own animations off: widgets see `prefers-reduced-motion`
        reducedMotion: !selectCanAnimateInterface(global),
        shouldKeepFocus: document.activeElement?.id === EDITABLE_INPUT_ID,
        bubbleGestures: { rtl: lang.isRtl },
        stoppedLabel: lang('WidgetStopped'),
        // Every press starts with its claim, before the bubble takes it
        onGestureClaim: () => {
          isMenuClickRef.current = false;
        },
        onBubbleGesture: (gesture) => {
          if (!getIsCancelled()) handleBubbleGesture(gesture);
        },
        onResize: (newHeight, anchor) => {
          if (getIsCancelled()) return;
          if (isLoaded) handleResize(newHeight, anchor);
          else pendingResize = [newHeight, anchor];
        },
        onLoaded: () => {
          isLoaded = true;
          if (getIsCancelled()) return;
          if (pendingResize) handleResize(...pendingResize);
          onReady();
        },
        onStorageCommit: (area, values) => {
          if (getIsCancelled() || isPreview || epoch !== storageEpochRef.current) return;
          if (area === 'session') {
            widgetSessionStorages.set(storageKey, values);
            return;
          }

          // A widget can commit after every task, so only the latest area is kept until it settles
          pendingLocalStorageRef.current = values;
          if (document.hidden) {
            flushStorage();
          } else if (!localCommitTimeoutRef.current) {
            localCommitTimeoutRef.current = window.setTimeout(commitLocalStorage, LOCAL_COMMIT_DELAY);
          }
        },
        onAction: (action) => {
          if (!getIsCancelled() && getGlobal().currentUserId === accountId) handleAction(action);
        },
        onRequest: (request) => handleRequest(request),
        onWallet: (call) => (getIsCancelled() ? Promise.reject() : handleWallet(call)),
        onCopyText: (text) => {
          if (!getIsCancelled()) handleCopyText(text);
        },
        onWatchPublicData: (isWatching) => {
          if (!getIsCancelled()) setIsWatchingPublicData(isWatching);
        },
        onDead,
      });
      host.element.setAttribute('role', 'group');
      host.element.setAttribute('aria-label', lang('Widget'));
    }, mount);
    return host!;
  });

  const dropPicture = useLastCallback(() => {
    const picture = pictureRef.current;
    if (!picture) return;
    pictureRef.current = undefined;
    setHasPicture(false);
    requestMutation(() => picture.destroy());
  });

  useEffect(() => {
    const handleSlotFreed = () => {
      if (isWaitingForSlotRef.current) setSlotRetry((retry) => retry + 1);
      else forceUpdate();
    };
    runtimeSlotListeners.add(handleSlotFreed);
    return () => {
      runtimeSlotListeners.delete(handleSlotFreed);
    };
  }, [forceUpdate]);

  useEffect(() => {
    if (isOnScreen && isWaitingForSlotRef.current) setSlotRetry((retry) => retry + 1);
  }, [isOnScreen]);

  useEffect(() => {
    function handleVisibilityChange() {
      setIsDocumentVisible(!document.hidden);
      if (document.hidden) flushStorage();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [flushStorage]);

  useEffect(() => {
    if (isLocked || failureAccountId !== accountId) {
      widgetFailures.clear();
      widgetSessionStorages.clear();
      widgetTransientLocalStorages.clear();
      failureAccountId = accountId;
    }
  }, [isLocked, accountId]);

  useEffect(() => {
    if (!canStart || !html || !accountId) return undefined;
    // The slot is taken here, not at render: the effects of one render pass run in turn, each seeing the ones before
    isWaitingForSlotRef.current = !isOnScreenRef.current && liveRuntimes.size >= MAX_OFFSCREEN_RUNTIMES;
    if (isWaitingForSlotRef.current) return undefined;
    let isCancelled = false;
    const runtime = Symbol('widget runtime');
    runtimeRef.current = runtime;
    liveRuntimes.add(runtime);
    let host: WidgetHost | undefined;
    const key = storageKey;
    let isDead = false;
    let isLoaded = false;

    onFullyIdle(async () => {
      try {
        const [{ WidgetHost: Runtime }, digest] = await Promise.all([
          loadWidgetSandbox(),
          crypto.subtle.digest('SHA-256', new TextEncoder().encode(html)),
        ]);
        if (isCancelled) return;
        const hash = bufferToHex(new Uint8Array(digest));
        const previous = widgetFailures.get(key);
        if (previous?.hash === hash && previous.count >= MAX_FAILURES) {
          setHasFailed(true);
          return;
        }
        if (previous?.hash !== hash) widgetFailures.delete(key);

        function handleDead() {
          if (isCancelled) return;
          isDead = true;
          // A dead host handles no input: presses on its last render are the message's
          hostRef.current = undefined;
          // The new run's own last render and its badge take the picture's place
          dropPicture();
          widgetFailures.set(key, { hash, count: (widgetFailures.get(key)?.count || 0) + 1 });
          setHasFailed(true);
          flushStorage();
          // A crashed run keeps its picture but no worker
          releaseRuntime(runtime);
        }

        requestForcedReflow(() => {
          if (isCancelled) return;
          try {
            host = createHost(Runtime, html, () => isCancelled, handleDead, () => {
              isLoaded = true;
              dropPicture();
            });
            hostRef.current = host;
            setHasRuntime(true);
            setHasFailed(false);
          } catch {
            handleDead();
            requestMutation(() => {
              if (!isCancelled) mountRef.current?.replaceChildren();
            });
          }
        });
      } catch {
        if (!isCancelled) setHasFailed(true);
      }
    });

    return () => {
      isCancelled = true;
      runtimeRef.current = undefined;
      // A freed slot lets a widget waiting near the viewport start
      releaseRuntime(runtime);
      // A run that ends without a crash breaks the series: only crashes in a row stop the widget
      if (host && !isDead) widgetFailures.delete(key);
      flushStorage();
      commitHeight();
      hostRef.current = undefined;
      setHasRuntime(false);
      setIsWatchingPublicData(false);
      if (!host) return;
      const lastHost = host;
      // A run that loaded leaves its picture, without the worker; one that crashed or never loaded goes, and an older
      // picture stays
      if (!isLoaded || isDead) {
        requestMutation(() => lastHost.destroy());
        return;
      }
      pictureRef.current = lastHost;
      setHasPicture(true);
      requestMutation(() => lastHost.suspend());
    };
    // The context is fixed for the host's life, so a change of the server's flags or of the wallet needs a new host
  }, [
    canStart, html, accountId, storageKey, canQuery, canBackgroundQuery, isCopy, isWalletAvailable,
    createHost, flushStorage, slotRetry, isOnScreenRef, storageEpoch,
  ]);

  // Declared after the run, so the picture its cleanup leaves on unmount goes too
  useEffect(() => dropPicture, [dropPicture]);

  useEffect(() => {
    hostRef.current?.setVisible(isVisible);
    if (!isVisible) flushStorage();
  }, [isVisible, hasRuntime, flushStorage]);

  // The stored widgets seen longest ago are the ones dropped past the cap
  useEffect(() => {
    if (isVisible && accountId && !isTransient && !isPreview) markMessageWidgetSeen({ accountId, chatId, messageId });
  }, [isVisible, accountId, isTransient, isPreview, chatId, messageId]);

  useEffect(() => {
    hostRef.current?.setData({ chatData: chatData || undefined, publicData: publicData || undefined });
  }, [chatData, publicData]);

  useEffect(() => {
    if (!hasRuntime) return undefined;
    if (!hasTimeOverlay) {
      hostRef.current?.setContentSafeArea({});
      return undefined;
    }
    const meta = findMessageMeta(rootRef.current!);
    if (!meta) return undefined;
    const observer = new ResizeObserver(updateSafeArea);
    observer.observe(meta);
    return () => observer.disconnect();
  }, [hasRuntime, hasTimeOverlay, updateSafeArea]);

  // Only a live renderer handles what began in the widget's document. On the mount, a stopped widget or a picture
  // (whose document takes no pointer, though a widget rule can give an element one back) nothing does, so the
  // message's own handlers take it, as on any other bubble
  const containEvent = useLastCallback((e: Event) => {
    const origin = e.composedPath()[0] as Node;
    if (!hostRef.current?.element.shadowRoot?.contains(origin)) return;
    if (e.type === 'contextmenu' && isMenuClickRef.current) {
      isMenuClickRef.current = false;
      return;
    }
    if (MOUSE_EVENTS.includes(e.type)) (e as Event & Record<string, unknown>)[WIDGET_EVENT_MARK] = true;
    else e.stopPropagation();
  });

  useEffect(() => {
    const mount = mountRef.current!;
    const types = [...CONTAINED_EVENTS, ...MOUSE_EVENTS];
    types.forEach((type) => mount.addEventListener(type, containEvent, { passive: true }));
    return () => types.forEach((type) => mount.removeEventListener(type, containEvent));
  }, [containEvent]);

  // The bubble's gestures follow the interface's direction
  useEffect(() => {
    hostRef.current?.setBubbleGestures({ rtl: lang.isRtl });
  }, [lang.isRtl, hasRuntime]);

  useEffect(() => {
    requestMutation(() => hostRef.current?.setProtected(Boolean(isProtected)));
  }, [isProtected, hasRuntime]);

  useEffect(() => {
    resizeMessageWidget(
      rootRef.current!, fixedHeight || naturalHeightRef.current, cachedHeightRef.current?.resizeAnchor ?? 'top',
    );
  }, [fixedHeight]);

  useEffect(() => {
    function updateFocus() {
      hostRef.current?.setKeepFocus(document.activeElement?.id === EDITABLE_INPUT_ID);
    }
    document.addEventListener('focusin', updateFocus);
    document.addEventListener('focusout', updateFocus);
    return () => {
      document.removeEventListener('focusin', updateFocus);
      document.removeEventListener('focusout', updateFocus);
    };
  }, []);

  useEffect(updateTheme, [theme, themeSettings, messageTextSize, isInSelectMode, hasRuntime, updateTheme]);

  const placeholder = !html || areWidgetsDisabled ? lang('WidgetUnavailable')
    : !IS_SUPPORTED ? lang('WidgetUnsupportedBrowser')
      : hasFailed ? lang('WidgetStopped') : lang('Widget');
  const widgetWidth = width ? `${Math.max(MIN_WIDTH, width) / REM}rem` : 'var(--max-width)';
  const widgetHeight = (fixedHeight || naturalHeightRef.current) / REM;

  return (
    <div
      ref={rootRef}
      className={buildClassName(
        styles.root,
        hasHeader && styles.withHeader,
        !hasTimeOverlay && styles.withFooter,
        isInSelectMode && styles.isSelecting,
      )}
      style={`--widget-width: ${widgetWidth}; --widget-height: ${widgetHeight}rem`}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
    >
      <div
        ref={mountRef}
        className={styles.mount}
        // Select mode hits the message, not the widget, whatever the widget's own styles say
        inert={isInSelectMode || undefined}
        data-stricterdom-ignore
        onMouseDown={skipWidgetEvent}
        onMouseUp={skipWidgetEvent}
        onClick={skipWidgetEvent}
        onDoubleClick={skipWidgetEvent}
        onAuxClick={skipWidgetEvent}
        onContextMenu={skipWidgetEvent}
      />
      {!hasRuntime && !hasPicture && <div className={styles.placeholder}>{placeholder}</div>}
    </div>
  );
}

// Teact's own propagation only: the page's native listeners still hear the event
function skipWidgetEvent(e: React.MouseEvent) {
  if ((e as unknown as Record<string, unknown>)[WIDGET_EVENT_MARK]) e.stopPropagation();
}

function findMessageMeta(root: HTMLElement) {
  return root.closest('.message-content')?.querySelector<HTMLElement>('.MessageMeta');
}

function measureSafeArea(root: HTMLElement): Partial<ContentSafeArea> {
  const meta = findMessageMeta(root);
  if (!meta) return {};

  const rootRect = root.getBoundingClientRect();
  const metaRect = meta.getBoundingClientRect();
  const bottom = Math.min(Math.ceil(rootRect.bottom - metaRect.top), MAX_SAFE_AREA_INSET);
  const cornerRight = rootRect.right - metaRect.left;
  const cornerLeft = metaRect.right - rootRect.left;
  return cornerRight < cornerLeft
    ? { bottom, cornerRight: Math.min(Math.ceil(cornerRight), MAX_SAFE_AREA_CORNER) }
    : { bottom, cornerLeft: Math.min(Math.ceil(cornerLeft), MAX_SAFE_AREA_CORNER) };
}

function getCopyProtectionInfo(global: GlobalState, lang: LangFn, chatId: string) {
  const chatType = selectWidgetChatType(global, chatId);
  if (chatType === 'channel') return lang('CopyProtectionInfoChannel');
  if (chatType !== 'private') return lang('CopyProtectionInfoGroup');

  // As the message menu says it: who switched it off, or, for a message sent protected, the message itself
  const fullInfo = selectUserFullInfo(global, chatId);
  if (fullInfo?.noForwardsPeerEnabled) {
    return lang('ContextMenuNoForwardsPeer', { name: getUserFullName(lang, selectUser(global, chatId)) });
  }

  return lang(fullInfo?.noForwardsMyEnabled ? 'ContextMenuNoForwardsYou' : 'CopyProtectionInfoMessage');
}

// What the widget learns of the user (`context.viewer`, only with `can_query`)
function buildWidgetViewer(user?: ApiUser): WidgetViewer | undefined {
  return user && {
    id: Number(user.id),
    firstName: user.firstName,
    lastName: user.lastName,
    username: getMainUsername(user),
    isPremium: user.isPremium,
  };
}

// Every key from the bubble the widget sits in (an outgoing one for the user's own message), the button tokens from
// the bubble's own controls and the text tokens from its message text (widget-sandbox sdk-v1 §5.1)
export function buildWidgetTheme(root: HTMLElement, theme: ThemeKey): WidgetTheme {
  const style = getComputedStyle(root);
  // An inline result preview has no message around it and carries the message's padding itself
  const messageStyle = getComputedStyle(root.closest('.message-content') || root);
  const params = extractCurrentThemeParams(root);
  // Every colour is solid, as it looks in the bubble: a translucent one over the bubble's fill, and the fill over the
  // chat's white or black, so nothing the widget paints with shows what is behind it
  const base = theme === 'dark' ? BLACK : WHITE;
  const background = flattenColor(readColor(style, '--background-color') || params.bg_color, base);
  const readBubbleColor = (property: string, fallback: string) => (
    flattenColor(readColor(style, property) || fallback, background)
  );
  const accent = readBubbleColor('--accent-color', params.accent_text_color);
  const hint = readBubbleColor('--secondary-color', params.hint_color);
  const separator = readBubbleColor('--message-table-border', params.section_separator_color);
  const secondaryBackground = readBubbleColor('--message-table-background', params.secondary_bg_color);

  return {
    colorScheme: getLuma(background) < DARK_LUMINANCE ? 'dark' : 'light',
    params: {
      ...params,
      bg_color: background,
      text_color: readBubbleColor('color', params.text_color),
      link_color: readBubbleColor('--color-links', params.link_color),
      hint_color: hint,
      subtitle_text_color: hint,
      accent_text_color: accent,
      secondary_bg_color: secondaryBackground,
      section_bg_color: background,
      section_header_text_color: accent,
      section_separator_color: separator,
      header_bg_color: background,
      bottom_bar_bg_color: background,
    },
    button: {
      bg: params.button_color,
      text: params.button_text_color,
      radius: style.getPropertyValue('--border-radius-default-small').trim() || undefined,
      font: BUTTON_FONT,
    },
    text: { fontSize: parseFloat(style.fontSize), lineHeight: TEXT_LINE_HEIGHT, padding: messageStyle.padding },
  };
}

function readColor(style: CSSStyleDeclaration, property: string) {
  const value = style.getPropertyValue(property).trim();
  return value ? prepareHexColor(value, true) : undefined;
}

function parseColor(value: string) {
  try {
    return convertColor(buildColor(value.trim()), 'srgb');
  } catch {
    return undefined;
  }
}

// The colour over an opaque base, as the bubble shows it: mixed in sRGB at the colour's own alpha
function flattenColor(color: string, base: string) {
  const top = parseColor(color);
  const bottom = parseColor(base);
  if (!top || !bottom) return color;

  const mixed = mixColors({ ...bottom, alpha: 1 }, { ...top, alpha: 1 }, top.alpha ?? 1, { space: 'srgb' });
  return serializeColor(mixed, { format: 'hex', collapse: false, alpha: false });
}

function getLuma(color: string) {
  const parsed = parseColor(color);
  if (!parsed) return 1;

  return parsed.coords.reduce<number>((sum, channel, index) => sum + (channel ?? 0) * LUMA_WEIGHTS[index], 0);
}

export default memo(withGlobal<OwnProps>((global, { theme }): Complete<StateProps> => ({
  accountId: global.currentUserId,
  isLocked: global.passcode.isScreenLocked || global.auth.isLoggingOut,
  themeSettings: selectSharedSettings(global).themes[theme],
  messageTextSize: selectSharedSettings(global).messageTextSize,
  isWalletAvailable: selectIsWalletAvailable(global),
  areWidgetsDisabled: global.appConfig.areWidgetsDisabled,
}))(Widget));
