import React, { FC, useEffect } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import { ApiMediaFormat } from '../../api/types';
import { GlobalState } from '../../global/types';
import { ThemeKey } from '../../types';

import { DARK_THEME_BG_COLOR, LIGHT_THEME_BG_COLOR } from '../../config';
import { getChatAvatarHash } from '../../global/helpers/chats'; // Direct import for better module splitting
import { selectIsRightColumnShown, selectTheme } from '../../global/selectors';
import useFlag from '../../hooks/useFlag';
import useShowTransition from '../../hooks/useShowTransition';
import { pause } from '../../util/schedulers';
import { preloadImage } from '../../util/files';
import preloadFonts from '../../util/fonts';
import * as mediaLoader from '../../util/mediaLoader';
import { Bundles, loadModule } from '../../util/moduleLoader';
import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import useCustomBackground from '../../hooks/useCustomBackground';

import './UiLoader.scss';

import telegramLogoPath from '../../assets/telegram-logo.svg';
import reactionThumbsPath from '../../assets/reaction-thumbs.png';
import monkeyPath from '../../assets/monkey.svg';

type OwnProps = {
  page: 'main' | 'authCode' | 'authPassword' | 'authPhoneNumber' | 'authQrCode';
  children: React.ReactNode;
};

type StateProps =
  Pick<GlobalState, 'uiReadyState' | 'shouldSkipHistoryAnimations'>
  & {
    isRightColumnShown?: boolean;
    leftColumnWidth?: number;
    isBackgroundBlurred?: boolean;
    theme: ThemeKey;
    customBackground?: string;
    backgroundColor?: string;
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
  main: () => Promise.all([
    loadModule(Bundles.Main, 'Main')
      .then(preloadFonts),
    preloadAvatars(),
    preloadImage(reactionThumbsPath),
  ]),
  authPhoneNumber: () => Promise.all([
    preloadFonts(),
    preloadImage(telegramLogoPath),
  ]),
  authCode: () => preloadImage(monkeyPath),
  authPassword: () => preloadImage(monkeyPath),
  authQrCode: preloadFonts,
};

const UiLoader: FC<OwnProps & StateProps> = ({
  page,
  children,
  isRightColumnShown,
  shouldSkipHistoryAnimations,
  leftColumnWidth,
  theme,
  backgroundColor,
  customBackground,
  isBackgroundBlurred,
}) => {
  const { setIsUiReady } = getActions();

  const [isReady, markReady] = useFlag();
  const {
    shouldRender: shouldRenderMask, transitionClassNames,
  } = useShowTransition(!isReady, undefined, true);

  const customBackgroundValue = useCustomBackground(theme, customBackground);

  useEffect(() => {
    let timeout: number | undefined;

    const safePreload = async () => {
      try {
        await preloadTasks[page]();
      } catch (err) {
        // Do nothing
      }
    };

    Promise.race([
      pause(MAX_PRELOAD_DELAY),
      safePreload(),
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

  const className = buildClassName(
    'middle',
    transitionClassNames,
    customBackground && 'custom-bg-image',
    backgroundColor && 'custom-bg-color',
    customBackground && isBackgroundBlurred && 'blurred',
    isRightColumnShown && 'with-right-column',
  );
  const inlineStyles = [
    `--theme-background-color: ${backgroundColor || (theme === 'dark' ? DARK_THEME_BG_COLOR : LIGHT_THEME_BG_COLOR)}`,
    customBackgroundValue && `--custom-background: ${customBackgroundValue}`,
  ];

  return (
    <div id="UiLoader">
      {children}
      {shouldRenderMask && !shouldSkipHistoryAnimations && (
        <div className={buildClassName('mask', transitionClassNames)}>
          {page === 'main' ? (
            <>
              <div
                className="left"
                style={leftColumnWidth ? `width: ${leftColumnWidth}px` : undefined}
              />
              <div
                className={className}
                style={buildStyle(...inlineStyles)}
              />
              {isRightColumnShown && <div className="right" />}
            </>
          ) : (
            <div className="blank" />
          )}
        </div>
      )}
    </div>
  );
};

export default withGlobal<OwnProps>(
  (global): StateProps => {
    const theme = selectTheme(global);
    const {
      isBlurred: isBackgroundBlurred, background: customBackground, backgroundColor,
    } = global.settings.themes[theme] || {};

    return {
      shouldSkipHistoryAnimations: global.shouldSkipHistoryAnimations,
      uiReadyState: global.uiReadyState,
      isRightColumnShown: selectIsRightColumnShown(global),
      leftColumnWidth: global.leftColumnWidth,
      theme,
      customBackground,
      isBackgroundBlurred,
      backgroundColor,
    };
  },
)(UiLoader);
