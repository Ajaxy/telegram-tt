import type { MouseEvent as ReactMouseEvent, RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiSponsoredMessage, ApiUser,
} from '../../../api/types';

import { getChatTitle, getUserFullName } from '../../../global/helpers';
import { selectChat, selectSponsoredMessage, selectUser } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { IS_ANDROID, IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import { getPeerColorClass } from '../../common/helpers/peerColor';
import renderText from '../../common/helpers/renderText';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';
import { preventMessageInputBlur } from '../helpers/preventMessageInputBlur';

import useAppLayout from '../../../hooks/useAppLayout';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useFlag from '../../../hooks/useFlag';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AboutAdsModal from '../../common/AboutAdsModal.async';
import Avatar from '../../common/Avatar';
import Button from '../../ui/Button';
import MessageAppendix from './MessageAppendix';
import SponsoredMessageContextMenuContainer from './SponsoredMessageContextMenuContainer.async';

import './SponsoredMessage.scss';

type OwnProps = {
  chatId: string;
  containerRef: RefObject<HTMLDivElement>;
};

type StateProps = {
  message?: ApiSponsoredMessage;
  peer?: ApiChat;
  bot?: ApiUser;
  channel?: ApiChat;
};

const INTERSECTION_DEBOUNCE_MS = 200;

const SponsoredMessage: FC<OwnProps & StateProps> = ({
  chatId,
  peer,
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
    openUrl,
    openPremiumModal,
  } = getActions();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
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
  const {
    isContextMenuOpen, contextMenuPosition,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref, IS_TOUCH_ENV, true, IS_ANDROID);
  const [isAboutAdsModalOpen, openAboutAdsModal, closeAboutAdsModal] = useFlag(false);
  const { isMobile } = useAppLayout();
  const withAvatar = Boolean(message?.isAvatarShown && peer);

  useEffect(() => {
    return shouldObserve ? observeIntersection(contentRef.current!, (target) => {
      if (target.isIntersecting) {
        viewSponsoredMessage({ chatId });
      }
    }) : undefined;
  }, [chatId, shouldObserve, observeIntersection, viewSponsoredMessage]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    preventMessageInputBlur(e);
    handleBeforeContextMenu(e);
  };

  const handleAvatarClick = useLastCallback(() => {
    if (!peer) {
      return;
    }

    openChat({ id: peer.id });
  });

  const handleLinkClick = useLastCallback((e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    openUrl({ url: message!.webPage!.url, shouldSkipModal: true });

    return false;
  });

  const handleCloseSponsoredMessage = useLastCallback(() => {
    openPremiumModal();
  });

  const handleClick = useLastCallback(() => {
    if (!message) return;
    if (message.chatInviteHash) {
      openChatByInvite({ hash: message.chatInviteHash });
    } else if (message.channelPostId) {
      focusMessage({ chatId: message.chatId!, messageId: message.channelPostId });
    } else {
      openChat({ id: message.chatId });

      if (message.startParam) {
        startBot({
          botId: message.chatId!,
          param: message.startParam,
        });
      }
    }
  });

  if (!message) {
    return undefined;
  }

  function renderAvatar() {
    return (
      <Avatar
        size={isMobile ? 'small-mobile' : 'small'}
        peer={peer}
        onClick={peer ? handleAvatarClick : undefined}
      />
    );
  }

  function renderContent() {
    if (message?.webPage) {
      return (
        <>
          <div className="text-content with-meta" dir="auto" ref={contentRef}>
            <div className="message-title message-peer" dir="ltr">
              {renderText(message.webPage.siteName)}
            </div>
            <span className="text-content-inner" dir="auto">
              {renderTextWithEntities({
                text: message!.text.text,
                entities: message!.text.entities,
              })}
            </span>
          </div>

          <Button
            className="SponsoredMessage__button"
            size="tiny"
            color="translucent"
            isRectangular
            onClick={handleLinkClick}
          >
            <i className="icon icon-arrow-right" aria-hidden />
            {lang('OpenLink')}
          </Button>
        </>
      );
    }

    return (
      <>
        <div className="message-title message-peer" dir="auto">
          {bot && renderText(getUserFullName(bot) || '')}
          {channel && renderText(message!.chatInviteTitle || getChatTitle(lang, channel) || '')}
        </div>
        <div className="text-content with-meta" dir="auto" ref={contentRef}>
          <span className="text-content-inner" dir="auto">
            {renderTextWithEntities({
              text: message!.text.text,
              entities: message!.text.entities,
            })}
          </span>
        </div>

        <Button
          className="SponsoredMessage__button"
          size="tiny"
          color="translucent"
          isRectangular
          onClick={handleClick}
        >
          {lang(message!.isBot
            ? 'Conversation.ViewBot'
            : (message!.channelPostId ? 'Conversation.ViewPost' : 'Conversation.ViewChannel'))}
        </Button>
      </>
    );
  }

  const contentClassName = buildClassName(
    'message-content has-shadow has-solid-background has-appendix',
    getPeerColorClass(peer || channel, true, true),
  );

  return (
    <div
      ref={ref}
      key="sponsored-message"
      className={buildClassName('SponsoredMessage Message open', withAvatar && 'with-avatar')}
    >
      {withAvatar && renderAvatar()}
      <div
        className={contentClassName}
        dir="auto"
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
      >
        <div className="content-inner" dir="auto">
          {channel && (
            <Avatar
              size="large"
              peer={channel}
              className={buildClassName('channel-avatar', lang.isRtl && 'is-rtl')}
            />
          )}
          <span className="message-title message-type">
            {message!.isRecommended ? lang('Message.RecommendedLabel') : lang('SponsoredMessage')}
          </span>
          {renderContent()}
        </div>
        <MessageAppendix />
        <Button
          className="message-action-button"
          color="translucent-white"
          round
          size="tiny"
          ariaLabel={lang('Close')}
          onClick={handleCloseSponsoredMessage}
        >
          <i className="icon icon-close" aria-hidden />
        </Button>
      </div>
      {contextMenuPosition && (
        <SponsoredMessageContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuPosition}
          message={message!}
          onAboutAds={openAboutAdsModal}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        />
      )}
      <AboutAdsModal
        isOpen={isAboutAdsModalOpen}
        onClose={closeAboutAdsModal}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const message = selectSponsoredMessage(global, chatId);
    const peer = message?.chatId ? selectChat(global, message?.chatId) : undefined;
    const { chatId: fromChatId, isBot } = message || {};

    return {
      message,
      peer,
      bot: fromChatId && isBot ? selectUser(global, fromChatId) : undefined,
      channel: !isBot && fromChatId ? selectChat(global, fromChatId) : undefined,
    };
  },
)(SponsoredMessage));
