import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback, useEffect } from '../../lib/teact/teact';
import { getActions } from '../../lib/teact/teactn';
import { withGlobal } from '../../global';

import type { TabState } from '../../global/types';
import { MAIN_THREAD_ID } from '../../api/types';

import { getCanPostInChat } from '../../global/helpers';
import { selectChat, selectChatFullInfo } from '../../global/selectors';

import useInterval from '../../hooks/schedulers/useInterval';
import useLang from '../../hooks/useLang';
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
  const lang = useLang();
  const { url, chatId, messageId } = openedGame || {};
  const isOpen = Boolean(url);

  const sendMessageAction = useSendMessageAction(chatId);
  useInterval(() => {
    sendMessageAction({ type: 'playingGame' });
  }, isOpen && canPost ? PLAY_GAME_ACTION_INTERVAL : undefined);

  const handleMessage = useCallback((event: MessageEvent<string>) => {
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
  (global, { openedGame }): StateProps => {
    const { chatId } = openedGame || {};
    const chat = chatId && selectChat(global, chatId);
    const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;
    const canPost = Boolean(chat) && getCanPostInChat(chat, MAIN_THREAD_ID, undefined, chatFullInfo);

    return {
      canPost,
    };
  },
)(GameModal));
