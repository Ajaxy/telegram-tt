import React, {
  FC, memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ApiChat } from '../../api/types';
import { GlobalState } from '../../global/types';
import { ThemeKey } from '../../types';

import windowSize from '../../util/windowSize';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { selectCurrentChat, selectTheme } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { extractCurrentThemeParams, validateHexColor } from '../../util/themeStyle';

import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useOnChange from '../../hooks/useOnChange';
import useWebAppFrame, { WebAppInboundEvent } from './hooks/useWebAppFrame';
import usePrevious from '../../hooks/usePrevious';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';
import Spinner from '../ui/Spinner';

import './WebAppModal.scss';

type WebAppButton = {
  isVisible: boolean;
  isActive: boolean;
  text: string;
  color: string;
  textColor: string;
  isProgressVisible: boolean;
};

export type OwnProps = {
  webApp?: GlobalState['webApp'];
};

type StateProps = {
  isInstalled?: boolean;
  chat?: ApiChat;
  theme?: ThemeKey;
};

const MAIN_BUTTON_ANIMATION_TIME = 250;
const PROLONG_INTERVAL = 45000; // 45s
const ANIMATION_WAIT = 400;

const WebAppModal: FC<OwnProps & StateProps> = ({
  webApp,
  chat,
  isInstalled,
  theme,
}) => {
  const {
    closeWebApp, sendWebViewData, prolongWebView, toggleBotInAttachMenu,
  } = getActions();
  const [mainButton, setMainButton] = useState<WebAppButton | undefined>();
  const lang = useLang();
  const {
    url, bot, buttonText, queryId,
  } = webApp || {};
  const isOpen = Boolean(url);
  const isSimple = !queryId;

  const handleEvent = useCallback((event: WebAppInboundEvent) => {
    const { eventType } = event;
    if (eventType === 'web_app_close') {
      closeWebApp();
    }

    if (eventType === 'web_app_data_send') {
      const { eventData } = event;
      closeWebApp();
      sendWebViewData({
        bot: bot!,
        buttonText: buttonText!,
        data: eventData.data,
      });
    }

    if (eventType === 'web_app_setup_main_button') {
      const { eventData } = event;
      const themeParams = extractCurrentThemeParams();
      // Validate colors if they are present
      const color = !eventData.color || validateHexColor(eventData.color) ? eventData.color
        : themeParams.button_color;
      const textColor = !eventData.text_color || validateHexColor(eventData.text_color) ? eventData.text_color
        : themeParams.text_color;
      setMainButton({
        isVisible: eventData.is_visible && Boolean(eventData.text?.trim().length),
        isActive: eventData.is_active,
        text: eventData.text || '',
        color,
        textColor,
        isProgressVisible: eventData.is_progress_visible,
      });
    }
  }, [bot, buttonText, closeWebApp, sendWebViewData]);

  const {
    ref, reloadFrame, sendEvent, sendViewport, sendTheme,
  } = useWebAppFrame(isOpen, isSimple, handleEvent);

  const shouldShowMainButton = mainButton?.isVisible && mainButton.text.trim().length > 0;

  useInterval(() => {
    prolongWebView({
      bot: bot!,
      queryId: queryId!,
      peer: chat!,
    });
  }, queryId ? PROLONG_INTERVAL : undefined, true);

  const handleMainButtonClick = useCallback(() => {
    sendEvent({
      eventType: 'main_button_pressed',
    });
  }, [sendEvent]);

  const handleRefreshClick = useCallback(() => {
    reloadFrame(webApp!.url);
  }, [reloadFrame, webApp]);

  // Notify view that height changed
  useOnChange(() => {
    setTimeout(() => {
      sendViewport();
    }, ANIMATION_WAIT);
  }, [mainButton?.isVisible, sendViewport]);

  // Notify view that theme changed
  useOnChange(() => {
    setTimeout(() => {
      sendTheme();
    }, ANIMATION_WAIT);
  }, [theme, sendTheme]);

  // Prevent refresh when rotating device
  useEffect(() => {
    if (!isOpen) return undefined;
    windowSize.disableRefresh();

    return () => {
      windowSize.enableRefresh();
    };
  }, [isOpen]);

  const handleToggleClick = useCallback(() => {
    toggleBotInAttachMenu({
      botId: bot!.id,
      isEnabled: !isInstalled,
    });
  }, [bot, isInstalled, toggleBotInAttachMenu]);

  const MoreMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        round
        ripple={!IS_SINGLE_COLUMN_LAYOUT}
        size="smaller"
        color="translucent"
        className={isMenuOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="More actions"
      >
        <i className="icon-more" />
      </Button>
    );
  }, []);

  const header = useMemo(() => {
    return (
      <div className="modal-header">
        <Button
          round
          color="translucent"
          size="smaller"
          ariaLabel={lang('Close')}
          onClick={closeWebApp}
        >
          <i className="icon-close" />
        </Button>
        <div className="modal-title">{bot?.firstName}</div>
        <DropdownMenu
          className="web-app-more-menu"
          trigger={MoreMenuButton}
          positionX="right"
        >
          <MenuItem icon="reload" onClick={handleRefreshClick}>{lang('WebApp.ReloadPage')}</MenuItem>
          {bot?.isAttachMenuBot && (
            <MenuItem icon={isInstalled ? 'stop' : 'install'} onClick={handleToggleClick} destructive={isInstalled}>
              {lang(isInstalled ? 'WebApp.RemoveBot' : 'WebApp.AddToAttachmentAdd')}
            </MenuItem>
          )}
        </DropdownMenu>
      </div>
    );
  }, [
    MoreMenuButton, bot, closeWebApp, handleRefreshClick, handleToggleClick, lang, isInstalled,
  ]);

  const prevMainButtonColor = usePrevious(mainButton?.color, true);
  const prevMainButtonTextColor = usePrevious(mainButton?.textColor, true);
  const prevMainButtonIsActive = usePrevious(mainButton && Boolean(mainButton.isActive), true);
  const prevMainButtonText = usePrevious(mainButton?.text, true);

  const mainButtonCurrentColor = mainButton?.color || prevMainButtonColor;
  const mainButtonCurrentTextColor = mainButton?.textColor || prevMainButtonTextColor;
  const mainButtonCurrentIsActive = mainButton?.isActive !== undefined ? mainButton.isActive : prevMainButtonIsActive;
  const mainButtonCurrentText = mainButton?.text || prevMainButtonText;

  useEffect(() => {
    if (!isOpen) setMainButton(undefined);
  }, [isOpen]);

  const [shouldDecreaseWebFrameSize, setShouldDecreaseWebFrameSize] = useState(false);
  const [shouldHideButton, setShouldHideButton] = useState(true);

  const buttonChangeTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (buttonChangeTimeout.current) clearTimeout(buttonChangeTimeout.current);
    if (!shouldShowMainButton) {
      setShouldDecreaseWebFrameSize(false);
      buttonChangeTimeout.current = setTimeout(() => {
        setShouldHideButton(true);
      }, MAIN_BUTTON_ANIMATION_TIME);
    } else {
      setShouldHideButton(false);
      buttonChangeTimeout.current = setTimeout(() => {
        setShouldDecreaseWebFrameSize(true);
      }, MAIN_BUTTON_ANIMATION_TIME);
    }
  }, [setShouldDecreaseWebFrameSize, shouldShowMainButton]);

  return (
    <Modal
      className="WebAppModal"
      isOpen={isOpen}
      onClose={closeWebApp}
      header={header}
      hasCloseButton
    >
      {isOpen && (
        <>
          <iframe
            ref={ref}
            className={buildClassName('web-app-frame', shouldDecreaseWebFrameSize && 'with-button')}
            src={url}
            title={`${bot?.firstName} Web App`}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            allow="camera; microphone; geolocation;"
            allowFullScreen
          />
          <Button
            className={buildClassName(
              'web-app-button',
              shouldShowMainButton && 'visible',
              shouldHideButton && 'hidden',
            )}
            style={`background-color: ${mainButtonCurrentColor}; color: ${mainButtonCurrentTextColor}`}
            disabled={!mainButtonCurrentIsActive}
            onClick={handleMainButtonClick}
          >
            {mainButtonCurrentText}
            {mainButton?.isProgressVisible && <Spinner color="white" />}
          </Button>
        </>
      )}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { webApp }): StateProps => {
    const { bot } = webApp || {};
    const isInstalled = Boolean(bot && global.attachMenu.bots[bot.id]);
    const chat = selectCurrentChat(global);
    const theme = selectTheme(global);

    return {
      isInstalled,
      chat,
      theme,
    };
  },
)(WebAppModal));
