import type { FC } from '../../lib/teact/teact';
import React, { useEffect } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import { ApiMediaFormat } from '../../api/types';
import type { GlobalState } from '../../global/types';
import type { ThemeKey } from '../../types';

import { getChatAvatarHash } from '../../global/helpers/chats'; // Direct import for better module splitting
import { selectIsRightColumnShown, selectTheme, selectIsCurrentUserPremium } from '../../global/selectors';
import { DARK_THEME_BG_COLOR, LIGHT_THEME_BG_COLOR } from '../../config';
import useFlag from '../../hooks/useFlag';
import useShowTransition from '../../hooks/useShowTransition';
import { pause } from '../../util/schedulers';
import { preloadImage } from '../../util/files';
import preloadFonts from '../../util/fonts';
import * as mediaLoader from '../../util/mediaLoader';
import { Bundles, loadModule } from '../../util/moduleLoader';
import buildClassName from '../../util/buildClassName';

import styles from './UiLoader.module.scss';

import telegramLogoPath from '../../assets/telegram-logo.svg';
import reactionThumbsPath from '../../assets/reaction-thumbs.png';
import premiumReactionThumbsPath from '../../assets/reaction-thumbs-premium.png';
import lockPreviewPath from '../../assets/lock.png';
import monkeyPath from '../../assets/monkey.svg';

export type UiLoaderPage =
  'main'
  | 'lock'
  | 'authCode'
  | 'authPassword'
  | 'authPhoneNumber'
  | 'authQrCode';

type OwnProps = {
  page?: UiLoaderPage;
  children: React.ReactNode;
};

type StateProps = Pick<GlobalState, 'uiReadyState' | 'shouldSkipHistoryAnimations'> & {
  isRightColumnShown?: boolean;
  leftColumnWidth?: number;
  theme: ThemeKey;
  isCurrentUserPremium?: boolean;
};

const MAX_PRELOAD_DELAY = 700;
const SECOND_STATE_DELAY = 1000;
const AVATARS_TO_PRELOAD = 10;

function preloadAvatars() {
  const { listIds, byId } = getGlobal().chats;
  if (!listIds.active) {
    return undefined;
  }

  return Promise.all(listIds.active.slice(0, AVATARS_TO_PRELOAD).map((chatId) => {
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
  main: (isCurrentUserPremium: boolean) => Promise.all([
    loadModule(Bundles.Main, 'Main')
      .then(preloadFonts),
    preloadAvatars(),
    preloadImage(isCurrentUserPremium ? premiumReactionThumbsPath : reactionThumbsPath),
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
};

const UiLoader: FC<OwnProps & StateProps> = ({
  page,
  children,
  isRightColumnShown,
  shouldSkipHistoryAnimations,
  leftColumnWidth,
  theme,
  isCurrentUserPremium,
}) => {
  const { setIsUiReady } = getActions();

  const [isReady, markReady] = useFlag();
  const {
    shouldRender: shouldRenderMask, transitionClassNames,
  } = useShowTransition(!isReady, undefined, true);

  useEffect(() => {
    let timeout: number | undefined;

    const safePreload = async () => {
      try {
        await preloadTasks[page!](isCurrentUserPremium!);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id="UiLoader"
      className={styles.root}
      style={`--theme-background-color: ${theme === 'dark' ? DARK_THEME_BG_COLOR : LIGHT_THEME_BG_COLOR}`}
    >
      {children}
      {shouldRenderMask && !shouldSkipHistoryAnimations && Boolean(page) && (
        <div className={buildClassName(styles.mask, transitionClassNames)}>
          {page === 'main' ? (
            <>
              <div
                className={styles.left}
                style={leftColumnWidth ? `width: ${leftColumnWidth}px` : undefined}
              />
              <div className={buildClassName(styles.middle, transitionClassNames)} />
              {isRightColumnShown && <div className={styles.right} />}
            </>
          ) : (
            <div className={styles.blank} />
          )}
        </div>
      )}
    </div>
  );
};

export default withGlobal<OwnProps>(
  (global): StateProps => {
    const theme = selectTheme(global);

    return {
      shouldSkipHistoryAnimations: global.shouldSkipHistoryAnimations,
      uiReadyState: global.uiReadyState,
      isRightColumnShown: selectIsRightColumnShown(global),
      leftColumnWidth: global.leftColumnWidth,
      theme,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(UiLoader);
