import React, {
  FC, memo, useCallback, useEffect,
} from '../../lib/teact/teact';
import { getActions } from '../../lib/teact/teactn';
import { GlobalState } from '../../global/types';

import windowSize from '../../util/windowSize';

import useLang from '../../hooks/useLang';
import useSendMessageAction from '../../hooks/useSendMessageAction';
import useInterval from '../../hooks/useInterval';

import Modal from '../ui/Modal';

import './GameModal.scss';

type GameEvents = { eventType: 'share_score' | 'share_game' };

const PLAY_GAME_ACTION_INTERVAL = 5000;

type OwnProps = {
  openedGame?: GlobalState['openedGame'];
  gameTitle?: string;
};

const GameModal: FC<OwnProps> = ({ openedGame, gameTitle }) => {
  const { closeGame, showNotification, openForwardMenu } = getActions();
  const lang = useLang();
  const { url, chatId, messageId } = openedGame || {};
  const isOpen = Boolean(url);

  const sendMessageAction = useSendMessageAction(chatId);
  useInterval(() => {
    sendMessageAction({ type: 'playingGame' });
  }, isOpen ? PLAY_GAME_ACTION_INTERVAL : undefined);

  const handleMessage = useCallback((event: MessageEvent<string>) => {
    try {
      const data = JSON.parse(event.data) as GameEvents;
      if (data.eventType === 'share_score') {
        openForwardMenu({ fromChatId: chatId, messageIds: [messageId], withMyScore: true });
        closeGame();
      }

      if (data.eventType === 'share_game') {
        showNotification({ message: 'Unsupported game action' });
      }
    } catch (e) {
      // Ignore messages from other origins
    }
  }, [chatId, closeGame, messageId, openForwardMenu, showNotification]);

  const handleLoad = useCallback((event: React.SyntheticEvent<HTMLIFrameElement>) => {
    event.currentTarget.focus();
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Prevent refresh when rotating device
  useEffect(() => {
    if (!isOpen) return undefined;

    windowSize.disableRefresh();

    return () => {
      windowSize.enableRefresh();
    };
  }, [isOpen]);

  return (
    <Modal
      className="GameModal"
      isOpen={isOpen}
      onClose={closeGame}
      title={gameTitle}
      hasCloseButton
    >
      {isOpen && (
        <iframe
          className="game-frame"
          onLoad={handleLoad}
          src={url}
          title={lang('AttachGame')}
          sandbox="allow-scripts allow-same-origin allow-orientation-lock"
          allow="fullscreen"
        />
      )}
    </Modal>
  );
};

export default memo(GameModal);
