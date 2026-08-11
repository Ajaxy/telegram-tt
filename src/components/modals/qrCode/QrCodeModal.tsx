import {
  memo, onFullyIdle, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiPeer } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { IThemeSettings, ThemeKey } from '../../../types';
import type { QrGradientStops } from '../../../util/qrCode/buildStyledQrCode';
import type { QrPreviewSnapshot, QrWallpaperSnapshot } from './generateQrCodeCard';

import { DARK_THEME_BG_COLOR, LIGHT_THEME_BG_COLOR } from '../../../config';
import { requestMeasure } from '../../../lib/fasterdom/fasterdom';
import { getChatAvatarHash } from '../../../global/helpers/chats';
import { getMainUsername } from '../../../global/helpers/users';
import { selectPeer, selectTheme, selectThemeValues } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { CLIPBOARD_ITEM_SUPPORTED, copyTextToClipboard } from '../../../util/clipboard';
import { createStyledQrCode } from '../../../util/qrCode/buildStyledQrCode';
import { buildWallpaperRenderModel } from '../../../util/wallpaper';
import { LOCAL_TGS_URLS } from '../../common/helpers/animatedAssets';
import formatUsername from '../../common/helpers/formatUsername';
import {
  buildQrPreviewSnapshot,
  generateQrCodeCard,
  logQrRenderError,
  QR_CODE_CARD_MIME_TYPE,
} from './generateQrCodeCard';

import useAsync from '../../../hooks/useAsync';
import useCustomBackground from '../../../hooks/useCustomBackground';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AnimatedIcon from '../../common/AnimatedIcon';
import Avatar from '../../common/Avatar';
import Wallpaper from '../../common/Wallpaper';
import Button from '../../ui/Button';
import Loading from '../../ui/Loading';
import Modal from '../../ui/Modal';

import styles from './QrCodeModal.module.scss';

export type OwnProps = {
  modal: TabState['qrCodeModal'];
};

type StateProps = {
  peer?: ApiPeer;
  username?: string;
  theme: ThemeKey;
  themeSettings?: IThemeSettings;
};

const QR_SIZE = 260;
const QR_PLANE_SIZE = 32;
const CAN_COPY_QR_IMAGE = Boolean(CLIPBOARD_ITEM_SUPPORTED && navigator.clipboard.write);

// Per-theme gradient, dark enough to keep the QR scannable on the white card
const QR_GRADIENT_BY_THEME: Record<ThemeKey, QrGradientStops> = {
  light: { from: '#3478f6', to: '#8b5cf6' },
  dark: { from: '#5b51d4', to: '#a531bb' },
};

const QrCodeModal = ({
  modal,
  peer,
  username,
  theme,
  themeSettings,
}: OwnProps & StateProps) => {
  const { closeQrCodeModal, showNotification } = getActions();

  const url = username ? formatUsername(username, true) : undefined;
  const isOpen = Boolean(modal) && Boolean(peer) && Boolean(url);

  const avatarRef = useRef<HTMLDivElement>();
  const usernameRef = useRef<HTMLDivElement>();
  const qrCodeRef = useRef<HTMLDivElement>();
  const previewBlobRef = useRef<Blob>();
  const previewBlobRenderIdRef = useRef(0);
  const [isQrMounted, markQrMounted, unmarkQrMounted] = useFlag();
  const [avatarLoadVersion, setAvatarLoadVersion] = useState(0);

  const lang = useLang();
  const customBackground = themeSettings?.background;
  const customBackgroundValue = useCustomBackground(theme, customBackground);

  const gradient = QR_GRADIENT_BY_THEME[theme];
  const shouldWaitForAvatar = Boolean(peer && getChatAvatarHash(peer, 'big'));
  const isCustomBackgroundReady = getIsCustomBackgroundReady(customBackground, customBackgroundValue);
  const wallpaperSnapshot = useMemo<QrWallpaperSnapshot>(() => ({
    model: buildWallpaperRenderModel(theme, themeSettings || {}),
    resourceUrl: getBackgroundResourceUrl(customBackgroundValue),
    fallbackColor: theme === 'dark' ? DARK_THEME_BG_COLOR : LIGHT_THEME_BG_COLOR,
  }), [customBackgroundValue, theme, themeSettings]);
  const usernameText = username
    ? formatUsername(username).toUpperCase()
    : undefined;

  const { result: qrCode, error: qrCodeError } = useAsync(async () => {
    if (!isOpen) return undefined;

    return createStyledQrCode({ size: QR_SIZE, gradient });
  }, [isOpen, gradient]);

  useEffect(() => {
    if (!isOpen || !qrCodeError) return;

    showNotification({ message: lang('ErrorUnexpected') });
  }, [isOpen, lang, qrCodeError, showNotification]);

  useLayoutEffect(() => {
    if (!isOpen) {
      unmarkQrMounted();
      return;
    }

    if (!url || !qrCode) {
      return;
    }

    const container = qrCodeRef.current!;
    let isCancelled = false;

    unmarkQrMounted();
    qrCode.update({ data: url });
    // The container may be a fresh node after a close/reopen (Modal remounts its
    // children), so always clear and re-append to avoid a blank or duplicated QR
    container.replaceChildren();
    qrCode.append(container);
    container.firstElementChild!.classList.add(styles.qrSvg);

    void qrCode.getRawData('svg').then(() => {
      if (!isCancelled) {
        markQrMounted();
      }
    }, () => {
      if (!isCancelled) {
        showNotification({ message: lang('ErrorUnexpected') });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, url, qrCode, lang, showNotification]);

  useLayoutEffect(() => {
    if (!isOpen) {
      previewBlobRef.current = undefined;
      previewBlobRenderIdRef.current += 1;
      return;
    }

    const previewBlobRenderId = previewBlobRenderIdRef.current + 1;
    previewBlobRenderIdRef.current = previewBlobRenderId;
    previewBlobRef.current = undefined;

    if (!url || !qrCode || !isCustomBackgroundReady || !CAN_COPY_QR_IMAGE) {
      return;
    }

    function attemptCapture() {
      if (previewBlobRenderIdRef.current !== previewBlobRenderId) {
        return;
      }

      requestMeasure(() => {
        if (previewBlobRenderIdRef.current !== previewBlobRenderId) {
          return;
        }

        const snapshot = buildQrPreviewSnapshot(
          wallpaperSnapshot, avatarRef.current, usernameRef.current,
        );
        if (!getIsPreviewSnapshotReady(snapshot, shouldWaitForAvatar)) {
          return;
        }

        generateQrCodeCard({
          snapshot,
          link: url!,
          gradient,
        }).then((blob) => {
          if (previewBlobRenderIdRef.current !== previewBlobRenderId) {
            return;
          }

          previewBlobRef.current = blob;
        }).catch((err) => {
          logQrRenderError(err);
          if (previewBlobRenderIdRef.current === previewBlobRenderId) {
            previewBlobRef.current = undefined;
            showNotification({ message: lang('ErrorUnexpected') });
          }
        });
      });
    }

    onFullyIdle(attemptCapture);

    return () => {
      if (previewBlobRenderIdRef.current === previewBlobRenderId) {
        previewBlobRenderIdRef.current += 1;
      }
    };
  }, [
    isOpen,
    url,
    qrCode,
    gradient,
    wallpaperSnapshot,
    isCustomBackgroundReady,
    customBackgroundValue,
    usernameText,
    shouldWaitForAvatar,
    avatarLoadVersion,
    lang,
    showNotification,
  ]);

  const handleClose = useLastCallback(() => {
    closeQrCodeModal();
  });

  const handleCopyQr = useLastCallback(async () => {
    if (!url) return;

    const previewBlob = previewBlobRef.current;

    if (previewBlob && CAN_COPY_QR_IMAGE) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            [previewBlob.type || QR_CODE_CARD_MIME_TYPE]: previewBlob,
          }),
        ]);
        showNotification({ message: lang('QrCodeCopied') });
        return;
      } catch {
        // Fall back to copying the link below
      }
    }

    copyTextToClipboard(url);
    showNotification({ message: lang('LinkCopied') });
  });

  const handleAvatarLoad = useLastCallback(() => {
    setAvatarLoadVersion((version) => version + 1);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      hasAbsoluteCloseButton
      absoluteCloseButtonColor="translucent-white"
      className={styles.root}
      contentClassName={styles.content}
    >
      <Wallpaper
        className={styles.wallpaper}
        isStatic
        style={buildStyle(
          `--qr-gradient-from: ${gradient.from}`,
          `--qr-gradient-to: ${gradient.to}`,
        )}
      >
        <div className={styles.card}>
          {peer && (
            <Avatar
              containerRef={avatarRef}
              peer={peer}
              size="jumbo"
              className={styles.avatar}
              onLoad={handleAvatarLoad}
            />
          )}
          <div className={styles.qrOuter}>
            <div
              ref={qrCodeRef}
              className={buildClassName(styles.qrContainer, isQrMounted && styles.qrContainerReady)}
              data-stricterdom-ignore
            />
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
        <Button className={styles.copyButton} onClick={handleCopyQr}>
          {lang('QrCodeCopy')}
        </Button>
      </Wallpaper>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { modal }): Complete<StateProps> => {
    const peer = modal?.peerId ? selectPeer(global, modal.peerId) : undefined;
    const username = peer ? getMainUsername(peer) : undefined;

    const theme = selectTheme(global);
    const themeSettings = selectThemeValues(global, theme);

    return {
      peer,
      username,
      theme,
      themeSettings,
    };
  },
)(QrCodeModal));

function getIsCustomBackgroundReady(customBackground?: string, customBackgroundValue?: string) {
  if (!customBackground || customBackground.startsWith('#')) {
    return true;
  }

  return Boolean(customBackgroundValue?.startsWith('url('));
}

function getBackgroundResourceUrl(value?: string) {
  return value?.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
}

function getIsPreviewSnapshotReady(snapshot: QrPreviewSnapshot, shouldWaitForAvatar: boolean) {
  if (shouldWaitForAvatar && !snapshot.avatar?.imageSrc) {
    return false;
  }

  return true;
}
