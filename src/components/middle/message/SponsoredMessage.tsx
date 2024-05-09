import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSponsoredMessage } from '../../../api/types';

import { selectSponsoredMessage } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { IS_ANDROID } from '../../../util/windowEnvironment';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';
import { preventMessageInputBlur } from '../helpers/preventMessageInputBlur';

import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useFlag from '../../../hooks/useFlag';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import AboutAdsModal from '../../common/AboutAdsModal.async';
import Avatar from '../../common/Avatar';
import Icon from '../../common/Icon';
import PeerColorWrapper from '../../common/PeerColorWrapper';
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
};

const INTERSECTION_DEBOUNCE_MS = 200;

const SponsoredMessage: FC<OwnProps & StateProps> = ({
  chatId,
  message,
  containerRef,
}) => {
  const {
    viewSponsoredMessage,
    openUrl,
    hideSponsoredMessages,
    clickSponsoredMessage,
    reportSponsoredMessage,
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
  } = useContextMenuHandlers(ref, undefined, true, IS_ANDROID);
  const [isAboutAdsModalOpen, openAboutAdsModal, closeAboutAdsModal] = useFlag(false);

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

  const handleReportSponsoredMessage = useLastCallback(() => {
    reportSponsoredMessage({ chatId, randomId: message!.randomId });
  });

  const handleHideSponsoredMessage = useLastCallback(() => {
    hideSponsoredMessages();
  });

  const handleClick = useLastCallback(() => {
    if (!message) return;

    clickSponsoredMessage({ chatId });
    openUrl({ url: message!.url, shouldSkipModal: true });
  });

  if (!message) {
    return undefined;
  }

  function renderContent() {
    if (!message) return undefined;
    return (
      <>
        <div className="message-title message-peer" dir="auto">{message.title}</div>
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
          {message.buttonText}
        </Button>
      </>
    );
  }

  return (
    <div
      ref={ref}
      key="sponsored-message"
      className="SponsoredMessage Message open"
    >
      <div
        className="message-content has-shadow has-solid-background has-appendix"
        dir="auto"
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
      >
        <PeerColorWrapper peerColor={message.peerColor} className="content-inner" dir="auto">
          {message.photo && (
            <Avatar
              size="large"
              photo={message.photo}
              className={buildClassName('channel-avatar', lang.isRtl && 'is-rtl')}
            />
          )}
          <span className="message-title message-type">
            {message!.isRecommended ? lang('Message.RecommendedLabel') : lang('SponsoredMessage')}
            <span onClick={openAboutAdsModal} className="ad-about">{lang('SponsoredMessageAdWhatIsThis')}</span>
          </span>
          {renderContent()}
        </PeerColorWrapper>
        <MessageAppendix />
        <div className="message-action-buttons">
          <Button
            className="message-action-button"
            color="translucent-white"
            round
            size="tiny"
            ariaLabel={lang('Close')}
            onClick={handleHideSponsoredMessage}
          >
            <Icon name="close" />
          </Button>
          {message.canReport && (
            <Button
              className="message-action-button"
              color="translucent-white"
              round
              size="tiny"
              ariaLabel={lang('More')}
              onClick={handleContextMenu}
              onContextMenu={handleContextMenu}
            >
              <Icon name="more" />
            </Button>
          )}
        </div>
      </div>
      {contextMenuPosition && (
        <SponsoredMessageContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuPosition}
          message={message!}
          onAboutAds={openAboutAdsModal}
          onReportAd={handleReportSponsoredMessage}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        />
      )}
      <AboutAdsModal
        isOpen={isAboutAdsModalOpen}
        isRevenueSharing={message.canReport}
        onClose={closeAboutAdsModal}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const message = selectSponsoredMessage(global, chatId);

    return {
      message,
    };
  },
)(SponsoredMessage));
