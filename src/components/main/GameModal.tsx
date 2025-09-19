import type { FC } from '../../lib/teact/teact';
import type React from '../../lib/teact/teact';
import { memo, useCallback, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { TabState } from '../../global/types';

import { getCanPostInChat } from '../../global/helpers';
import { selectChat, selectChatFullInfo } from '../../global/selectors';

import useInterval from '../../hooks/schedulers/useInterval';
import useOldLang from '../../hooks/useOldLang';
import useSendMessageAction from '../../hooks/useSendMessageAction';

import Modal from '../ui/Modal';

import './GameModal.scss';

type GameEvents = { eventType: 'share_score' | 'share_game' };

const PLAY_GAME_ACTION_INTERVAL = 5000;

type OwnProps = {
  openedGame?: TabState['openedGame'];
  gameTitle?: string;
};

type StateProps = {
  canPost?: boolean;
};

const GameModal: FC<OwnProps & StateProps> = ({ openedGame, gameTitle, canPost }) => {
  const { closeGame, openForwardMenu } = getActions();
  const lang = useOldLang();
  const { url, chatId, messageId } = openedGame || {};
  const isOpen = Boolean(url);

  const sendMessageAction = useSendMessageAction(chatId);
  useInterval(() => {
    sendMessageAction({ type: 'playingGame' });
  }, isOpen && canPost ? PLAY_GAME_ACTION_INTERVAL : undefined);

  const handleMessage = useCallback((event: MessageEvent<string>) => {
    if (!chatId || !messageId) return;
    try {
      const data = JSON.parse(event.data) as GameEvents;
      if (data.eventType === 'share_score') {
        openForwardMenu({ fromChatId: chatId, messageIds: [messageId], withMyScore: true });
        closeGame();
      }

      if (data.eventType === 'share_game') {
        openForwardMenu({ fromChatId: chatId, messageIds: [messageId] });
        closeGame();
      }
    } catch (e) {
      // Ignore other messages
    }
  }, [chatId, closeGame, messageId, openForwardMenu]);

  const handleLoad = useCallback((event: React.SyntheticEvent<HTMLIFrameElement>) => {
    event.currentTarget.focus();
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

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

export default memo(withGlobal<OwnProps>(
  (global, { openedGame }): Complete<StateProps> => {
    const { chatId } = openedGame || {};
    const chat = chatId && selectChat(global, chatId);
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;
    const canPost = Boolean(chat) && getCanPostInChat(chat, undefined, undefined, chatFullInfo);

    return {
      canPost,
    };
  },
)(GameModal));
