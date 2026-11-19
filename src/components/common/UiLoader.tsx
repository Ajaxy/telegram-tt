import { onFullyIdle } from '../../lib/teact/heavyAnimation';
import { useEffect, useState } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { TabState } from '../../global/types';
import type { IThemeSettings, ThemeKey } from '../../types';
import { ApiMediaFormat } from '../../api/types';

import { FOLDERS_POSITION_LEFT } from '../../config';
import { getChatAvatarHash } from '../../global/helpers/chats'; // Direct import for better module splitting
import {
  selectAreFoldersPresent, selectIsRightColumnShown, selectTabState, selectTheme, selectThemeValues,
} from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import buildClassName from '../../util/buildClassName';
import { preloadImage } from '../../util/files';
import preloadFonts from '../../util/fonts';
import { localizationReadyPromise } from '../../util/localization';
import * as mediaLoader from '../../util/mediaLoader';
import { Bundles, loadModule } from '../../util/moduleLoader';
import { pause } from '../../util/schedulers';
import { saveSkeletonSnapshot } from '../../util/skeletonSnapshot';

import useEffectOnce from '../../hooks/useEffectOnce';
import useFlag from '../../hooks/useFlag';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

import appStyles from '../App.module.scss';
import styles from './UiLoader.module.scss';

import starIconPath from '../../assets/icons/star/star.webp';
import monkeyPath from '../../assets/monkey.svg';
import telegramLogoPath from '../../assets/telegram-logo.svg';
import pausePreviewPath from '../../assets/tgs-previews/Pause.svg';
import playPreviewPath from '../../assets/tgs-previews/Play.svg';
import lockPreviewPath from '../../assets/tgs-previews/settings/Lock.avif';

export type UiLoaderPage =
  'main'
  | 'lock'
  | 'inactive'
  | 'authCode'
  | 'authPassword'
  | 'authPhoneNumber'
  | 'authQrCode';

type OwnProps = {
  page?: UiLoaderPage;
  children: React.ReactNode;
  isMobile?: boolean;
};

type StateProps = Pick<TabState, 'uiReadyState' | 'shouldSkipHistoryAnimations'> & {
  hasCachedChats: boolean;
  isRightColumnShown?: boolean;
  leftColumnWidth?: number;
  isFoldersSidebarShown?: boolean;
  theme: ThemeKey;
  themeSettings?: IThemeSettings;
  shouldUseSystemTheme?: boolean;
};

const MAX_PRELOAD_DELAY = 700;
const SECOND_STATE_DELAY = 1000;
const SKELETON_SAVE_DELAY = 1000;
const AVATARS_TO_PRELOAD = 10;

function loadRequiredBundle(page?: UiLoaderPage) {
  if (page === 'main' || page === 'lock') {
    return loadModule(Bundles.Main);
  }

  if (page === 'authCode' || page === 'authPassword') {
    return loadModule(Bundles.Auth);
  }

  return Promise.resolve();
}

function preloadAvatars() {
  const { listIds, byId } = getGlobal().chats;
  if (!listIds.active) {
    return undefined;
  }

  return Promise.all(listIds.active.slice(0, AVATARS_TO_PRELOAD).map(async (chatId) => {
    const chat = byId[chatId];
    if (!chat) {
      return undefined;
    }

    const avatarHash = getChatAvatarHash(chat);
    if (!avatarHash) {
      return undefined;
    }

    return mediaLoader.fetch(avatarHash, ApiMediaFormat.BlobUrl);
  }));
}

const preloadTasks = {
  main: () => Promise.all([
    preloadFonts(),
    preloadImage(starIconPath),
    preloadImage(playPreviewPath),
    preloadImage(pausePreviewPath),
    localizationReadyPromise,
  ]),
  authPhoneNumber: () => Promise.all([
    preloadFonts(),
    preloadImage(telegramLogoPath),
  ]),
  authCode: () => preloadImage(monkeyPath),
  authPassword: () => preloadImage(monkeyPath),
  authQrCode: preloadFonts,
  lock: () => Promise.all([
    preloadFonts(),
    preloadImage(lockPreviewPath),
  ]),
  inactive: () => {
  },
};

const UiLoader = ({
  page,
  children,
  isRightColumnShown,
  shouldSkipHistoryAnimations,
  leftColumnWidth,
  isFoldersSidebarShown,
  uiReadyState,
  hasCachedChats,
  theme,
  themeSettings,
  shouldUseSystemTheme,
}: OwnProps & StateProps) => {
  const { setIsUiReady } = getActions();

  const [isReady, markReady] = useFlag();
  // An account switch reveals the page through a view transition, which already cross-fades it
  const [isRevealedByTransition] = useState(() => Boolean(document.activeViewTransition));
  const isReloading = isReady && uiReadyState === 0;
  const {
    shouldRender: shouldRenderMask, transitionClassNames,
  } = useShowTransitionDeprecated(
    !isReady || isReloading,
    undefined,
    true,
    // The islands skeleton dissolves into the loaded ones slowly enough to be seen
    page === 'main' && !isReloading ? 'slow' : 'fast',
    isRevealedByTransition && page === 'main' && hasCachedChats,
  );
  const canSaveSkeleton = page === 'main' && uiReadyState === 2;

  useEffectOnce(() => {
    let timeout: number | undefined;

    const safePreload = async (currentPage: UiLoaderPage) => {
      if (currentPage === 'main') {
        void preloadAvatars()?.catch(() => undefined);
      }
      try {
        await preloadTasks[currentPage]();
      } catch (err) {
        // Do nothing
      }
    };

    Promise.all([
      loadRequiredBundle(page),
      Promise.race([
        pause(MAX_PRELOAD_DELAY),
        page ? safePreload(page) : Promise.resolve(),
      ]),
    ]).then(() => {
      markReady();
      setIsUiReady({ uiReadyState: 1 });

      timeout = window.setTimeout(() => {
        setIsUiReady({ uiReadyState: 2 });
      }, SECOND_STATE_DELAY);
    });

    return () => {
      if (timeout) {
        clearTimeout(timeout);
        timeout = undefined;
      }

      setIsUiReady({ uiReadyState: 0 });
    };
  });

  // Remeasures the islands for the next page load whenever their layout, width or colors may change
  useEffect(() => {
    if (!canSaveSkeleton) return undefined;

    let timeout: number | undefined;
    const scheduleSave = () => {
      window.clearTimeout(timeout);
      // Waits out layout and theme transitions
      timeout = window.setTimeout(() => onFullyIdle(() => {
        saveSkeletonSnapshot(shouldUseSystemTheme ? theme : undefined);
      }), SKELETON_SAVE_DELAY);
    };

    scheduleSave();
    window.addEventListener('resize', scheduleSave);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('resize', scheduleSave);
    };
  }, [
    canSaveSkeleton, theme, themeSettings, shouldUseSystemTheme,
    leftColumnWidth, isFoldersSidebarShown, isRightColumnShown,
  ]);

  return (
    <>
      {children}
      {shouldRenderMask && (isReloading || !shouldSkipHistoryAnimations) && Boolean(page) && (
        <div className={buildClassName(styles.mask, isReloading && styles.outgoing, transitionClassNames)}>
          {page === 'main' && <div className={buildClassName('wallpaper-snapshot', styles.wallpaper)} aria-hidden />}
          {page === 'main' ? (
            <div className={buildClassName(styles.main, isFoldersSidebarShown && styles.foldersSidebarVisible)}>
              {isFoldersSidebarShown && <div className={styles.foldersSidebar} />}
              <div
                className={styles.left}
                style={leftColumnWidth ? `width: ${leftColumnWidth}px` : undefined}
              />
              <div className={styles.middle} />
              {isRightColumnShown && <div className={styles.right} />}
            </div>
          ) : (page === 'inactive' || page === 'lock') ? (
            <div className={buildClassName(styles.blank, appStyles.bg)} />
          ) : (
            <div className={styles.blank} />
          )}
        </div>
      )}
    </>
  );
};

export default withGlobal<OwnProps>(
  (global, { isMobile }): Complete<StateProps> => {
    const tabState = selectTabState(global);

    const { foldersPosition, shouldUseSystemTheme } = selectSharedSettings(global);
    const theme = selectTheme(global);

    return {
      hasCachedChats: Boolean(global.chats.listIds.active),
      shouldSkipHistoryAnimations: tabState.shouldSkipHistoryAnimations,
      uiReadyState: tabState.uiReadyState,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      leftColumnWidth: global.leftColumnWidth,
      isFoldersSidebarShown: foldersPosition === FOLDERS_POSITION_LEFT && !isMobile && selectAreFoldersPresent(global),
      theme,
      themeSettings: selectThemeValues(global, theme),
      shouldUseSystemTheme,
    };
  },
)(UiLoader);
