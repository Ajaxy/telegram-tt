import {
  memo, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiAvailableReaction,
  ApiPeer,
  ApiSavedStarGift,
  ApiShareTheme,
  ApiShareThemeBackdrop,
  ApiStickerSet,
} from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { QrEmojiSource, QrLayerSnapshot, QrMediaSource } from './generateQrCodeCard';
import type { ShareThemeDraft } from './helpers/shareTheme';
import type { QrThemePanel } from './QrCodeThemeEditor';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import {
  getHasAdminRight, getReactionKey, getStickerMediaHash, isChatChannel, isChatSuperGroup,
} from '../../../global/helpers';
import { getMainUsername } from '../../../global/helpers/users';
import {
  selectCanAnimateInterface,
  selectCanPlayAnimatedEmojis,
  selectChat,
  selectIsCurrentUserPremium,
  selectPeer,
  selectPeerFullInfo,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { CLIPBOARD_ITEM_SUPPORTED, copyTextToClipboard } from '../../../util/clipboard';
import { isUserId } from '../../../util/entities/ids';
import { createStyledQrCode } from '../../../util/qrCode/buildStyledQrCode';
import { computeQrThemeColors } from '../../../util/qrCode/shareThemeColors';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import formatUsername from '../../common/helpers/formatUsername';
import { getGiftAttributes } from '../../common/helpers/gifts';
import { REM } from '../../common/helpers/mediaDimensions';
import { LayerMotion } from './helpers/floatingLayer';
import { getEmojiPresets, getIsSameShareTheme, getShareThemeBackdrop } from './helpers/shareTheme';
import { CARD_BOUNCE_ANIMATION, CARD_DIP_ANIMATION } from './helpers/themeWave';
import {
  buildQrPreviewSnapshot,
  generateQrCodeCard,
  QR_CODE_CARD_MIME_TYPE,
} from './generateQrCodeCard';

import { useTransitionActiveKey } from '../../../hooks/animations/useTransitionActiveKey';
import useAsync from '../../../hooks/useAsync';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useResizeObserver from '../../../hooks/useResizeObserver';
import useSyncEffect from '../../../hooks/useSyncEffect';
import useFreeMessagesCode from './hooks/useFreeMessagesCode';
import useQrCodeSwap from './hooks/useQrCodeSwap';

import AnimatedIcon from '../../common/AnimatedIcon';
import Loading from '../../ui/Loading';
import Modal from '../../ui/Modal';
import QrCodeFeePill from './QrCodeFeePill';
import QrCodeThemeEditor from './QrCodeThemeEditor';
import QrFloatingLayer from './QrFloatingLayer';
import QrThemeWave from './QrThemeWave';

import styles from './QrCodeModal.module.scss';

export type OwnProps = {
  modal: TabState['qrCodeModal'];
};

type StateProps = {
  peer?: ApiPeer;
  username?: string;
  shareTheme?: ApiShareTheme;
  backdrops?: ApiShareThemeBackdrop[];
  uniqueGifts?: ApiSavedStarGift[];
  availableReactions?: ApiAvailableReaction[];
  restrictedEmoji?: ApiStickerSet;
  isCurrentUserPremium?: boolean;
  isSelf?: boolean;
  paidMessagesStars?: number;
  permanentFreeLink?: string;
  canEditTheme?: boolean;
  canAnimate?: boolean;
  canPlayAnimatedEmojis?: boolean;
};

const QR_SIZE = 260;
const QR_MARGIN = 0;
const QR_PLANE_SIZE = 32;
const CAN_COPY_QR_IMAGE = Boolean(CLIPBOARD_ITEM_SUPPORTED && navigator.clipboard.write);
const CARD_TOP_MARGIN = REM;
const CARD_PANEL_GAP = 0.75 * REM;
const GRADIENT_RADIUS = '31rem';
const GRADIENT_CENTER = '50% 40%';

const QrCodeModal = ({
  modal,
  peer,
  username,
  shareTheme,
  backdrops,
  uniqueGifts,
  availableReactions,
  restrictedEmoji,
  isCurrentUserPremium,
  isSelf,
  paidMessagesStars,
  permanentFreeLink,
  canEditTheme,
  canAnimate,
  canPlayAnimatedEmojis,
}: OwnProps & StateProps) => {
  const {
    closeQrCodeModal,
    showNotification,
    loadShareThemeBackdrops,
    loadFullUser,
    loadFullChat,
    loadQrCodeUniqueGifts,
    setPeerShareTheme,
    openGiftModal,
    loadGlobalPrivacySettings,
  } = getActions();

  const url = username ? formatUsername(username, true) : undefined;
  const isOpen = Boolean(modal) && Boolean(peer) && Boolean(url);
  const {
    mode: freeMode, timerEndsAt, link, isLinkPending, getIsCodeExpiring, removeFee, toggleTimer, resetCode, restoreFee,
  } = useFreeMessagesCode({
    isOpen, price: paidMessagesStars, plainLink: url, permanentLink: permanentFreeLink,
  });

  const surfaceRef = useRef<HTMLDivElement>();
  const cardWrapperRef = useRef<HTMLDivElement>();
  const cardRef = useRef<HTMLDivElement>();
  const panelRef = useRef<HTMLDivElement>();
  const layerMotionRef = useRef<LayerMotion>();
  // The modal stays mounted when closed, so each opening starts a fresh clock and offset
  useSyncEffect(() => {
    if (isOpen || !layerMotionRef.current) {
      layerMotionRef.current = new LayerMotion();
    }
  }, [isOpen]);
  const usernameRef = useRef<HTMLDivElement>();
  const qrCodeRef = useRef<HTMLDivElement>();
  const swapCanvasRef = useRef<HTMLCanvasElement>();
  const shownLinkRef = useRef<string>();
  const [isQrMounted, markQrMounted, unmarkQrMounted] = useFlag();
  const [draftTheme, setDraftTheme] = useState<ShareThemeDraft>(shareTheme);
  const isDraftDirtyRef = useRef(false);
  const [activePanel, setActivePanel] = useState<QrThemePanel>();

  const lang = useLang();

  const backdrop = getShareThemeBackdrop(draftTheme, backdrops);
  const colors = useMemo(() => (
    computeQrThemeColors(backdrop.centerColor, backdrop.edgeColor)
  ), [backdrop.centerColor, backdrop.edgeColor]);

  const gift = draftTheme?.type === 'gift' ? draftTheme.gift : undefined;
  const emojis = draftTheme?.type === 'emojiBackdrop' && draftTheme.emojis.length ? draftTheme.emojis : undefined;
  const giftAttributes = gift && getGiftAttributes(gift);
  const patternSticker = giftAttributes?.pattern?.sticker;
  const patternUrl = useMedia(patternSticker && getStickerMediaHash(patternSticker, 'preview'));
  const emojiPresets = useMemo(() => getEmojiPresets(restrictedEmoji), [restrictedEmoji]);

  // Backdrop and gift changes reveal the new scene with a wave, while emoji changes animate within the layer
  const backgroundKey = useTransitionActiveKey(
    [backdrop.centerColor, backdrop.edgeColor, gift?.id],
    !activePanel || !canAnimate,
  );
  const waveStartedAt = useMemo(() => (backgroundKey ? performance.now() : undefined), [backgroundKey]);
  const emojiKey = useTransitionActiveKey(
    [emojis?.map(getReactionKey).join(',')],
    !activePanel || !canAnimate,
  );

  // The card bounces when a wave starts and dips when only the emojis change
  const cardAnimationKeysRef = useRef({ backgroundKey, emojiKey });
  useEffect(() => {
    const lastKeys = cardAnimationKeysRef.current;
    cardAnimationKeysRef.current = { backgroundKey, emojiKey };

    let animation;
    if (backgroundKey !== lastKeys.backgroundKey) {
      animation = CARD_BOUNCE_ANIMATION;
    } else if (emojiKey !== lastKeys.emojiKey) {
      animation = CARD_DIP_ANIMATION;
    }

    if (animation) {
      cardRef.current?.animate(animation.keyframes, { duration: animation.duration });
    }
  }, [backgroundKey, emojiKey]);

  const usernameText = username
    ? formatUsername(username).toUpperCase()
    : undefined;

  const peerId = peer?.id;
  useEffect(() => {
    if (!isOpen || !peerId) {
      setActivePanel(undefined);
      return;
    }

    loadShareThemeBackdrops();
    // The theme may have been changed on another device, and there are no updates for it
    if (isUserId(peerId)) {
      loadFullUser({ userId: peerId });
    } else {
      loadFullChat({ chatId: peerId, force: true });
    }
  }, [isOpen, peerId]);

  // Saved and server themes replace the draft unless it has unsaved picks
  useEffect(() => {
    if (!isOpen) {
      isDraftDirtyRef.current = false;
      return;
    }

    if (!isDraftDirtyRef.current) {
      setDraftTheme(shareTheme);
    }
  }, [isOpen, shareTheme]);

  useEffect(() => {
    if (isOpen && isSelf) loadGlobalPrivacySettings();
  }, [isOpen, isSelf, loadGlobalPrivacySettings]);

  useEffect(() => {
    if (activePanel === 'gifts' && !uniqueGifts) {
      loadQrCodeUniqueGifts();
    }
  }, [activePanel, uniqueGifts]);

  const { holdQrCode, presentQrCode, releaseQrCode } = useQrCodeSwap({
    isOpen,
    canAnimate,
    svgSize: QR_SIZE,
    svgMargin: QR_MARGIN,
    canvasRef: swapCanvasRef,
    cardRef,
    containerRef: qrCodeRef,
  });

  const { result: qrCode, error: qrCodeError } = useAsync(async () => {
    if (!isOpen) return undefined;

    return createStyledQrCode({ size: QR_SIZE, margin: QR_MARGIN, color: colors.ink });
  }, [isOpen, colors.ink]);

  useEffect(() => {
    if (!isOpen || !qrCodeError) return;

    showNotification({ message: lang('ErrorUnexpected') });
  }, [isOpen, lang, qrCodeError, showNotification]);

  useLayoutEffect(() => {
    if (!isOpen) {
      unmarkQrMounted();
      shownLinkRef.current = undefined;
      return;
    }

    if (!link || !qrCode) {
      return;
    }

    const container = qrCodeRef.current!;
    let isCancelled = false;
    const isSwap = holdQrCode(shownLinkRef.current, link);
    shownLinkRef.current = link;

    if (!isSwap) unmarkQrMounted();
    qrCode.update({ data: link });
    // The container may be a fresh node after a close/reopen (Modal remounts its
    // children), so always clear and re-append to avoid a blank or duplicated QR
    container.replaceChildren();
    qrCode.append(container);
    container.firstElementChild!.classList.add(styles.qrSvg);

    void qrCode.getRawData('svg').then(() => {
      if (isCancelled) return;

      markQrMounted();
      presentQrCode(link, container.firstElementChild as SVGSVGElement, qrCode._qr!.getModuleCount(), isSwap);
    }, () => {
      if (!isCancelled) {
        releaseQrCode();
        showNotification({ message: lang('ErrorUnexpected') });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, link, qrCode, lang, showNotification, holdQrCode, presentQrCode, releaseQrCode]);

  // The card shrinks into the space above an open panel
  const updateCardTransform = useLastCallback(() => {
    const cardWrapper = cardWrapperRef.current;
    if (!cardWrapper) return;

    if (!activePanel) {
      requestMutation(() => {
        cardWrapper.style.transform = '';
      });
      return;
    }

    requestMeasure(() => {
      const panel = panelRef.current;
      if (!panel) return;

      const height = cardWrapper.offsetHeight;
      const available = panel.offsetTop - CARD_PANEL_GAP - CARD_TOP_MARGIN;
      const scale = Math.min(1, available / height);
      const top = CARD_TOP_MARGIN + (available - height * scale) / 2;
      const translateY = top - cardWrapper.offsetTop;

      requestMutation(() => {
        cardWrapper.style.transform = `translateY(${translateY}px) scale(${scale})`;
      });
    });
  });

  useLayoutEffect(() => {
    updateCardTransform();
  }, [activePanel, draftTheme, backdrops]);
  // The surface is remounted on each opening
  useResizeObserver(surfaceRef, updateCardTransform, !isOpen);

  const handleThemeChange = useLastCallback((theme: ShareThemeDraft) => {
    isDraftDirtyRef.current = true;
    setDraftTheme(theme);
  });

  // The draft is kept as is, since the saved theme may reach the props a render later
  const saveDraftTheme = useLastCallback(() => {
    if (!isDraftDirtyRef.current) return;

    isDraftDirtyRef.current = false;
    if (!peer || !canEditTheme || getIsSameShareTheme(draftTheme, shareTheme)) return;
    if (draftTheme?.type === 'gift' && !draftTheme.inputGift) return;

    setPeerShareTheme({
      peerId: peer.id,
      theme: draftTheme?.type === 'gift' ? { ...draftTheme, inputGift: draftTheme.inputGift! } : draftTheme,
    });
  });

  const closeModal = useLastCallback(() => {
    saveDraftTheme();
    closeQrCodeModal();
  });

  // With an open panel, the back button and Escape close the panel first
  const handleClose = useLastCallback(() => {
    if (activePanel) {
      handlePanelChange(undefined);
      return;
    }

    closeModal();
  });

  const handlePanelChange = useLastCallback((panel?: QrThemePanel) => {
    if (!panel) {
      saveDraftTheme();
    }

    setActivePanel(panel);
  });

  const handleLayerClick = useLastCallback(() => {
    if (activePanel) {
      handlePanelChange(undefined);
    }
  });

  const handleLoadMoreGifts = useLastCallback(() => {
    loadQrCodeUniqueGifts();
  });

  const handleBrowseGifts = useLastCallback(() => {
    closeModal();
    openGiftModal({ forUserId: peer!.id });
  });

  const handleCopyQr = useLastCallback(() => {
    if (!link) return;

    if (isLinkPending) {
      showNotification({ message: lang('PleaseWait') });
      return;
    }

    if (getIsCodeExpiring()) {
      showNotification({ message: lang('QrFreeToastExpiring') });
      return;
    }

    if (CAN_COPY_QR_IMAGE) {
      // The previous slide stays mounted while a wave reveals the new one
      const slide = surfaceRef.current?.querySelector<HTMLElement>(`[data-wave-key="${backgroundKey}"]`) || undefined;
      const snapshot = buildQrPreviewSnapshot(
        buildLayerSnapshot(slide, emojis?.length || 0, patternUrl, giftAttributes?.backdrop?.patternColor),
        usernameRef.current,
      );
      const blobPromise = generateQrCodeCard({
        snapshot,
        link,
        inkColor: colors.ink,
        gradientStops: colors.gradientStops,
      });

      navigator.clipboard.write([new ClipboardItem({ [QR_CODE_CARD_MIME_TYPE]: blobPromise })])
        .then(() => {
          showNotification({ message: lang('QrCodeCopied') });
        })
        .catch(copyLink);
      return;
    }

    copyLink();
  });

  function copyLink() {
    copyTextToClipboard(link!);
    showNotification({ message: lang('LinkCopied') });
  }

  const themeStyle = buildStyle(
    `--qr-foreground-color: ${colors.foreground}`,
    `--qr-control-color: ${colors.control}`,
  );
  // Set on the card itself, since Chromium may skip inherited updates under its running bounce
  const cardStyle = `--qr-ink-color: ${colors.ink}`;
  const backgroundStyle = `background-image: radial-gradient(circle ${GRADIENT_RADIUS} at ${GRADIENT_CENTER}, `
    + `${colors.gradientStops.join(', ')})`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      hasAbsoluteCloseButton
      isBackButton={Boolean(activePanel)}
      absoluteCloseButtonColor="translucent-white"
      className={styles.root}
      contentClassName={styles.content}
      dialogStyle={themeStyle}
    >
      <div ref={surfaceRef} className={styles.surface}>
        <QrThemeWave
          className={styles.background}
          activeKey={backgroundKey}
          startedAt={waveStartedAt}
          ringColor={colors.wave}
          originRef={cardRef}
        >
          <div className={styles.backgroundSlide} style={backgroundStyle}>
            <QrFloatingLayer
              emojis={emojis}
              gift={gift}
              availableReactions={availableReactions}
              foregroundColor={colors.foreground}
              cardRef={cardRef}
              cardLayoutKey={activePanel}
              motion={layerMotionRef.current!}
              waveStartedAt={waveStartedAt}
              noAnimation={!canAnimate}
              canPlayEmojis={canPlayAnimatedEmojis}
              onClick={handleLayerClick}
            />
          </div>
        </QrThemeWave>
        <div ref={cardWrapperRef} className={styles.cardWrapper}>
          <div ref={cardRef} className={styles.card} style={cardStyle}>
            <div className={styles.qrOuter}>
              <div
                ref={qrCodeRef}
                className={buildClassName(styles.qrContainer, isQrMounted && styles.qrContainerReady)}
                data-stricterdom-ignore
              />
              {canAnimate && <canvas ref={swapCanvasRef} className={styles.swapCanvas} />}
              <AnimatedIcon
                tgsUrl={LOCAL_TGS_URLS.QrPlane}
                size={QR_PLANE_SIZE}
                play
                className={buildClassName(styles.qrPlane, !isQrMounted && styles.qrPlaneHidden)}
                nonInteractive
                noLoop={false}
                noTransition
              />
              <div className={buildClassName(styles.qrLoading, isQrMounted && styles.qrLoadingHidden)}>
                <Loading />
              </div>
            </div>
            {usernameText && <div ref={usernameRef} className={styles.username}>{usernameText}</div>}
          </div>
          {Boolean(paidMessagesStars) && (
            <QrCodeFeePill
              price={paidMessagesStars}
              mode={freeMode}
              timerEndsAt={timerEndsAt}
              ink={colors.ink}
              foreground={colors.foreground}
              canAnimate={canAnimate}
              onRemoveFee={removeFee}
              onToggleTimer={toggleTimer}
              onReset={resetCode}
              onRestoreFee={restoreFee}
            />
          )}
        </div>
        {canEditTheme && (
          <QrCodeThemeEditor
            theme={draftTheme}
            activePanel={activePanel}
            panelRef={panelRef}
            backdrops={backdrops}
            uniqueGifts={uniqueGifts}
            availableReactions={availableReactions}
            emojiPresets={emojiPresets}
            isCurrentUserPremium={isCurrentUserPremium}
            isSelf={isSelf}
            onPanelChange={handlePanelChange}
            onThemeChange={handleThemeChange}
            onLoadMoreGifts={handleLoadMoreGifts}
            onBrowseGifts={handleBrowseGifts}
          />
        )}
        <button
          type="button"
          className={styles.copyButton}
          inert={Boolean(activePanel)}
          onClick={handleCopyQr}
        >
          {lang('QrCodeCopy')}
        </button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const peerId = modal?.peerId;
    const peer = peerId ? selectPeer(global, peerId) : undefined;
    const username = peer ? getMainUsername(peer) : undefined;
    const chat = peerId ? selectChat(global, peerId) : undefined;
    const isSelf = Boolean(peerId) && peerId === global.currentUserId;
    const canEditChatTheme = chat && (isChatChannel(chat) || isChatSuperGroup(chat))
      && getHasAdminRight(chat, 'changeInfo');

    return {
      peer,
      username,
      shareTheme: peerId ? selectPeerFullInfo(global, peerId)?.shareTheme : undefined,
      backdrops: global.shareThemeBackdrops?.list,
      uniqueGifts: modal?.uniqueGifts,
      availableReactions: global.reactions.availableReactions,
      restrictedEmoji: global.restrictedEmoji,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      isSelf,
      paidMessagesStars: isSelf ? global.settings.byKey.nonContactPeersPaidStars : undefined,
      permanentFreeLink: global.settings.byKey.permanentFreeMessagesLink,
      canEditTheme: isSelf || canEditChatTheme,
      canAnimate: selectCanAnimateInterface(global),
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
    };
  },
)(QrCodeModal));

function buildLayerSnapshot(
  slide: HTMLElement | undefined, emojiCount: number, patternUrl?: string, patternColor?: string,
): QrLayerSnapshot {
  const emojiSources = new Array<QrEmojiSource | undefined>(emojiCount).fill(undefined);
  slide?.querySelectorAll<HTMLElement>('[data-kind="emoji"]').forEach((tile) => {
    const pick = Number(tile.dataset.pick);
    emojiSources[pick] ||= getEmojiSource(tile);
  });

  const modelTiles = slide ? Array.from(slide.querySelectorAll<HTMLElement>('[data-kind="model"]')) : [];

  return {
    emojiSources,
    modelSource: modelTiles.map(getTileSource).find(Boolean),
    symbol: patternUrl && patternColor ? { url: patternUrl, color: patternColor } : undefined,
  };
}

function getEmojiSource(tile: HTMLElement): QrEmojiSource | undefined {
  const source = getTileSource(tile);
  if (!source) return undefined;

  // Text-color emoji get the layer color through a filter on the media or its container
  let tinted: HTMLElement | undefined;
  for (let current: HTMLElement | null = source; current && current !== tile; current = current.parentElement) {
    if (getComputedStyle(current).filter !== 'none') {
      tinted = current;
      break;
    }
  }

  return { source, tintColor: tinted && getComputedStyle(tinted).color };
}

function getTileSource(tile: HTMLElement): QrMediaSource | undefined {
  const media = tile.querySelectorAll<QrMediaSource>('canvas, img, video');
  const ready = Array.from(media).filter(getIsMediaReady);
  // A loaded thumbnail stays in the DOM, hidden, after the full media appears
  return ready.find((element) => getIsVisibleInTile(element, tile)) || ready[0];
}

function getIsMediaReady(element: QrMediaSource) {
  if (element instanceof HTMLCanvasElement) return element.width > 0;
  if (element instanceof HTMLImageElement) return element.complete && element.naturalWidth > 0;
  return element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
}

function getIsVisibleInTile(element: HTMLElement, tile: HTMLElement) {
  for (let current: HTMLElement | null = element; current && current !== tile; current = current.parentElement) {
    if (getComputedStyle(current).opacity === '0') return false;
  }

  return true;
}
