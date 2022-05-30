import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChat, ApiSponsoredMessage, ApiUser } from '../../../api/types';

import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';
import { selectChat, selectSponsoredMessage, selectUser } from '../../../global/selectors';
import { getChatTitle, getUserFullName } from '../../../global/helpers';
import renderText from '../../common/helpers/renderText';
import useLang from '../../../hooks/useLang';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';

import Button from '../../ui/Button';

import './SponsoredMessage.scss';

type OwnProps = {
  chatId: string;
  containerRef: RefObject<HTMLDivElement>;
};

type StateProps = {
  message?: ApiSponsoredMessage;
  bot?: ApiUser;
  channel?: ApiChat;
};

const INTERSECTION_DEBOUNCE_MS = 200;

const SponsoredMessage: FC<OwnProps & StateProps> = ({
  chatId,
  message,
  containerRef,
  bot,
  channel,
}) => {
  const {
    viewSponsoredMessage,
    openChat,
    openChatByInvite,
    startBot,
    focusMessage,
  } = getActions();
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldObserve = Boolean(message);
  const {
    observe: observeIntersection,
  } = useIntersectionObserver({
    rootRef: containerRef,
    debounceMs: INTERSECTION_DEBOUNCE_MS,
    threshold: 1,
  });

  useEffect(() => {
    return shouldObserve ? observeIntersection(contentRef.current!, (target) => {
      if (target.isIntersecting) {
        viewSponsoredMessage({ chatId });
      }
    }) : undefined;
  }, [chatId, shouldObserve, observeIntersection, viewSponsoredMessage]);

  const handleClick = useCallback(() => {
    if (!message) return;
    if (message.chatInviteHash) {
      openChatByInvite({ hash: message.chatInviteHash });
    } else if (message.channelPostId) {
      focusMessage({ chatId: message.chatId, messageId: message.channelPostId });
    } else {
      openChat({ id: message.chatId });

      if (message.startParam) {
        startBot({
          botId: message.chatId,
          param: message.startParam,
        });
      }
    }
  }, [focusMessage, message, openChat, openChatByInvite, startBot]);

  if (!message) {
    return undefined;
  }

  return (
    <div className="SponsoredMessage Message open" key="sponsored-message">
      <div className="message-content has-shadow has-solid-background" dir="auto">
        <div className="content-inner" dir="auto">
          <div className="message-title" dir="ltr">
            {bot && renderText(getUserFullName(bot) || '')}
            {channel && renderText(message.chatInviteTitle || getChatTitle(lang, channel, bot) || '')}
          </div>

          <p className="text-content with-meta" dir="auto" ref={contentRef}>
            <span className="text-content-inner" dir="auto">
              {renderTextWithEntities(message.text.text, message.text.entities)}
            </span>

            <span className="MessageMeta" dir="ltr">
              <span className="message-signature">{lang('SponsoredMessage')}</span>
            </span>
          </p>

          <Button color="secondary" size="tiny" ripple onClick={handleClick} className="SponsoredMessage__button">
            {lang(message.isBot
              ? 'Conversation.ViewBot'
              : (message.channelPostId ? 'Conversation.ViewPost' : 'Conversation.ViewChannel'))}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const message = selectSponsoredMessage(global, chatId);
    const { chatId: fromChatId, isBot } = message || {};

    return {
      message,
      bot: fromChatId && isBot ? selectUser(global, fromChatId) : undefined,
      channel: !isBot && fromChatId ? selectChat(global, fromChatId) : undefined,
    };
  },
)(SponsoredMessage));
