import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { TabState } from '../../global/types';
import { ApiMediaFormat } from '../../api/types';

import { FOLDERS_POSITION_LEFT } from '../../config';
import { getChatAvatarHash } from '../../global/helpers/chats'; // Direct import for better module splitting
import { selectAreFoldersPresent, selectIsRightColumnShown, selectTabState } from '../../global/selectors';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import buildClassName from '../../util/buildClassName';
import { preloadImage } from '../../util/files';
import preloadFonts from '../../util/fonts';
import { localizationReadyPromise } from '../../util/localization';
import * as mediaLoader from '../../util/mediaLoader';
import { Bundles, loadModule } from '../../util/moduleLoader';
import { pause } from '../../util/schedulers';

import useEffectOnce from '../../hooks/useEffectOnce';
import useFlag from '../../hooks/useFlag';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';

// Workaround for incorrect bundling by Webpack: force including in the main chunk
import '../ui/Modal.scss';
import './Avatar.scss';
import appStyles from '../App.module.scss';
import styles from './UiLoader.module.scss';

import lockPreviewPath from '../../assets/lock.png';
import monkeyPath from '../../assets/monkey.svg';
import spoilerMaskPath from '../../assets/spoilers/mask.svg';
import telegramLogoPath from '../../assets/telegram-logo.svg';

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
  isRightColumnShown?: boolean;
  leftColumnWidth?: number;
  isFoldersSidebarShown?: boolean;
};

const MAX_PRELOAD_DELAY = 700;
const SECOND_STATE_DELAY = 1000;
const AVATARS_TO_PRELOAD = 10;

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
    loadModule(Bundles.Main)
      .then(preloadFonts),
    preloadAvatars(),
    preloadImage(spoilerMaskPath),
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

const UiLoader: FC<OwnProps & StateProps> = ({
  page,
  children,
  isRightColumnShown,
  shouldSkipHistoryAnimations,
  leftColumnWidth,
  isFoldersSidebarShown,
}) => {
  const { setIsUiReady } = getActions();

  const [isReady, markReady] = useFlag();
  const {
    shouldRender: shouldRenderMask, transitionClassNames,
  } = useShowTransitionDeprecated(!isReady, undefined, true);

  useEffectOnce(() => {
    let timeout: number | undefined;

    const safePreload = async () => {
      try {
        await preloadTasks[page!]();
      } catch (err) {
        // Do nothing
      }
    };

    Promise.race([
      pause(MAX_PRELOAD_DELAY),
      page ? safePreload() : Promise.resolve(),
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

  return (
    <>
      {children}
      {shouldRenderMask && !shouldSkipHistoryAnimations && Boolean(page) && (
        <div className={buildClassName(styles.mask, transitionClassNames)}>
          {page === 'main' ? (
            <div className={buildClassName(styles.main, isFoldersSidebarShown && styles.foldersSidebarVisible)}>
              {isFoldersSidebarShown && <div className={styles.foldersSidebar} />}
              <div
                className={styles.left}
                style={leftColumnWidth ? `width: ${leftColumnWidth}px` : undefined}
              />
              <div className={buildClassName(styles.middle, appStyles.bg)} />
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

    const { foldersPosition } = selectSharedSettings(global);

    return {
      shouldSkipHistoryAnimations: tabState.shouldSkipHistoryAnimations,
      uiReadyState: tabState.uiReadyState,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      leftColumnWidth: global.leftColumnWidth,
      isFoldersSidebarShown: foldersPosition === FOLDERS_POSITION_LEFT && !isMobile && selectAreFoldersPresent(global),
    };
  },
)(UiLoader);
