import React, { FC, useEffect } from '../../lib/teact/teact';
import { getGlobal, withGlobal } from '../../lib/teact/teactn';

import { ApiMediaFormat } from '../../api/types';
import { GlobalActions, GlobalState } from '../../global/types';

import { getChatAvatarHash } from '../../modules/helpers/chats'; // Direct import for better module splitting
import useFlag from '../../hooks/useFlag';
import useShowTransition from '../../hooks/useShowTransition';
import { pause } from '../../util/schedulers';
import { preloadImage } from '../../util/files';
import preloadFonts from '../../util/fonts';
import * as mediaLoader from '../../util/mediaLoader';
import { Bundles, loadModule } from '../../util/moduleLoader';
import { pick } from '../../util/iteratees';
import buildClassName from '../../util/buildClassName';

import './UiLoader.scss';

// @ts-ignore
import telegramLogoPath from '../../assets/telegram-logo.svg';
// @ts-ignore
import authCaptionPath from '../../assets/auth-caption.png';
// @ts-ignore
import monkeyPath from '../../assets/monkey.svg';
import { selectIsRightColumnShown } from '../../modules/selectors';

type OwnProps = {
  page: 'main' | 'authCode' | 'authPassword' | 'authPhoneNumber' | 'authQrCode';
  children: any;
};

type StateProps = Pick<GlobalState, 'uiReadyState'> & {
  hasCustomBackground?: boolean;
  isRightColumnShown?: boolean;
};

type DispatchProps = Pick<GlobalActions, 'setIsUiReady'>;

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

    return mediaLoader.fetch(avatarHash, ApiMediaFormat.DataUri);
  }));
}

const preloadTasks = {
  main: () => Promise.all([
    loadModule(Bundles.Main, 'Main')
      .then(preloadFonts),
    preloadAvatars(),
  ]),
  authPhoneNumber: () => Promise.all([
    preloadImage(authCaptionPath),
    preloadImage(telegramLogoPath),
  ]),
  authCode: () => Promise.all([
    preloadImage(monkeyPath),
    preloadFonts(),
  ]),
  authPassword: () => preloadImage(monkeyPath),
  authQrCode: preloadFonts,
};

const UiLoader: FC<OwnProps & StateProps & DispatchProps> = ({
  page,
  children,
  hasCustomBackground,
  isRightColumnShown,
  setIsUiReady,
}) => {
  const [isReady, markReady] = useFlag();
  const {
    shouldRender: shouldRenderMask, transitionClassNames,
  } = useShowTransition(!isReady, undefined, true);

  useEffect(() => {
    let timeout: number | undefined;

    Promise.race([
      pause(MAX_PRELOAD_DELAY),
      preloadTasks[page](),
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
    <div id="UiLoader">
      {children}
      {shouldRenderMask && (
        <div className={buildClassName('mask', transitionClassNames)}>
          {page === 'main' ? (
            <>
              <div className="left" />
              <div
                className={buildClassName(
                  'middle',
                  hasCustomBackground && 'custom-bg-image',
                  isRightColumnShown && 'with-right-column',
                )}
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
    return {
      uiReadyState: global.uiReadyState,
      hasCustomBackground: Boolean(global.settings.byKey.customBackground),
      isRightColumnShown: selectIsRightColumnShown(global),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['setIsUiReady']),
)(UiLoader);
