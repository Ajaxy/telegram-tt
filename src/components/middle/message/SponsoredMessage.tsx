import type { RefObject } from 'react';
import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSponsoredMessage } from '../../../api/types';
import type { ISettings } from '../../../types';
import { MediaViewerOrigin } from '../../../types';

import {
  getIsDownloading,
  getMessageContent,
  getMessageDownloadableMedia,
} from '../../../global/helpers';
import {
  selectActiveDownloads, selectCanAutoLoadMedia, selectCanAutoPlayMedia,
  selectSponsoredMessage,
  selectTheme,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { IS_ANDROID } from '../../../util/windowEnvironment';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';
import { preventMessageInputBlur } from '../helpers/preventMessageInputBlur';
import { calculateMediaDimensions, getMinMediaWidth, MIN_MEDIA_WIDTH_WITH_TEXT } from './helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { type ObserveFn, useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import BadgeButton from '../../common/BadgeButton';
import Icon from '../../common/icons/Icon';
import PeerColorWrapper from '../../common/PeerColorWrapper';
import Button from '../../ui/Button';
import MessageAppendix from './MessageAppendix';
import Photo from './Photo';
import SponsoredMessageContextMenuContainer from './SponsoredMessageContextMenuContainer.async';
import Video from './Video';

import './SponsoredMessage.scss';

type OwnProps = {
  chatId: string;
  containerRef: RefObject<HTMLDivElement>;
  observeIntersectionForLoading: ObserveFn;
  observeIntersectionForPlaying: ObserveFn;
};

type StateProps = {
  message?: ApiSponsoredMessage;
  theme: ISettings['theme'];
  isDownloading?: boolean;
  canAutoLoadMedia?: boolean;
  canAutoPlayMedia?: boolean;
};

const INTERSECTION_DEBOUNCE_MS = 200;

const SponsoredMessage: FC<OwnProps & StateProps> = ({
  chatId,
  message,
  containerRef,
  theme,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  isDownloading,
  canAutoLoadMedia,
  canAutoPlayMedia,
}) => {
  const {
    viewSponsoredMessage,
    openUrl,
    hideSponsoredMessages,
    clickSponsoredMessage,
    openMediaViewer,
    openAboutAdsModal,
  } = getActions();

  const lang = useOldLang();
  // eslint-disable-next-line no-null/no-null
  const contentRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  const shouldObserve = Boolean(message);

  const { isMobile } = useAppLayout();
  const {
    observe: observeIntersection,
  } = useIntersectionObserver({
    rootRef: containerRef,
    debounceMs: INTERSECTION_DEBOUNCE_MS,
    threshold: 1,
  });
  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref, undefined, true, IS_ANDROID);

  useEffect(() => {
    return shouldObserve ? observeIntersection(contentRef.current!, (target) => {
      if (target.isIntersecting) {
        viewSponsoredMessage({ peerId: chatId });
      }
    }) : undefined;
  }, [chatId, shouldObserve, observeIntersection, viewSponsoredMessage]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    preventMessageInputBlur(e);
    handleBeforeContextMenu(e);
  };

  const handleHideSponsoredMessage = useLastCallback(() => {
    hideSponsoredMessages();
  });

  const {
    photo, video,
  } = message ? getMessageContent(message) : { photo: undefined, video: undefined };

  const isGif = video?.isGif;
  const hasMedia = Boolean(photo || video);

  const handleClick = useLastCallback(() => {
    if (!message) return;

    clickSponsoredMessage({ isMedia: photo || isGif ? true : undefined, peerId: chatId });
    openUrl({ url: message.url, shouldSkipModal: true });
  });

  const handleOpenMedia = useLastCallback(() => {
    clickSponsoredMessage({ isMedia: true, peerId: chatId });
    openMediaViewer({
      origin: MediaViewerOrigin.SponsoredMessage,
      chatId,
      isSponsoredMessage: true,
    });
  });

  const handleOpenAboutAdsModal = useLastCallback(() => {
    openAboutAdsModal({ chatId });
  });

  const extraPadding = 0;

  const sizeCalculations = useMemo(() => {
    let calculatedWidth;
    let contentWidth: number | undefined;
    const noMediaCorners = false;
    let style = '';

    if (photo || video) {
      let width: number | undefined;
      if (photo) {
        width = calculateMediaDimensions({
          media: photo,
          isMobile,
        }).width;
      } else if (video) {
        width = calculateMediaDimensions({
          media: video,
          isMobile,
        }).width;
      }

      if (width) {
        if (width < MIN_MEDIA_WIDTH_WITH_TEXT) {
          contentWidth = width;
        }
        calculatedWidth = Math.max(getMinMediaWidth(), width);
      }
    }

    if (calculatedWidth) {
      style = `width: ${calculatedWidth + extraPadding}px`;
    }

    return {
      contentWidth, noMediaCorners, style,
    };
  }, [photo, video, isMobile]);

  const {
    contentWidth, style,
  } = sizeCalculations;

  if (!message || !message.content) {
    return undefined;
  }

  function renderContent() {
    if (!message) return undefined;
    return (
      <>
        <div className="message-title message-peer" dir="auto">{message.title}</div>
        {Boolean(message.content?.text) && (
          <div className="text-content with-meta" dir="auto" ref={contentRef}>
            <span className="text-content-inner" dir="auto">
              {renderTextWithEntities({
                text: message.content.text.text,
                entities: message.content.text.entities,
              })}
            </span>
          </div>
        )}

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

  function renderMediaContent() {
    if (!message) return undefined;

    if (photo) {
      return (
        <Photo
          photo={photo}
          theme={theme}
          canAutoLoad={canAutoLoadMedia}
          isDownloading={isDownloading}
          observeIntersection={observeIntersectionForLoading}
          noAvatars
          onClick={handleClick}
          forcedWidth={contentWidth}
        />
      );
    }
    if (video) {
      return (
        <Video
          video={video}
          observeIntersectionForLoading={observeIntersectionForLoading}
          observeIntersectionForPlaying={observeIntersectionForPlaying}
          noAvatars
          canAutoLoad={canAutoLoadMedia}
          canAutoPlay={canAutoPlayMedia}
          isDownloading={isDownloading}
          onClick={isGif ? handleClick : handleOpenMedia}
          forcedWidth={contentWidth}
        />
      );
    }

    return undefined;
  }

  return (
    <div
      ref={ref}
      key="sponsored-message"
      className="SponsoredMessage Message open sponsored-media-preview"
    >
      <div
        className="message-content media has-shadow has-solid-background has-appendix"
        dir="auto"
        style={style}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
      >
        <PeerColorWrapper peerColor={message.peerColor} className="content-inner" dir="auto">
          {renderMediaContent()}
          {message.photo && (
            <Avatar
              size="large"
              photo={message.photo}
              className={buildClassName('channel-avatar', lang.isRtl && 'is-rtl')}
            />
          )}
          <span className={buildClassName('message-title message-type', hasMedia && 'has-media')}>
            {message!.isRecommended ? lang('Message.RecommendedLabel') : lang('SponsoredMessage')}
            <BadgeButton onClick={handleOpenAboutAdsModal} className="ad-about">
              {lang('SponsoredMessageAdWhatIsThis')}
            </BadgeButton>
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
            <Icon name="close" className="sponsored-action-icon" />
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
              <Icon name="more" className="sponsored-action-icon" />
            </Button>
          )}
        </div>
      </div>
      {contextMenuAnchor && (
        <SponsoredMessageContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          triggerRef={ref}
          message={message!}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const message = selectSponsoredMessage(global, chatId);

    const activeDownloads = selectActiveDownloads(global);
    const downloadableMedia = message ? getMessageDownloadableMedia(message) : undefined;
    const isDownloading = downloadableMedia && getIsDownloading(activeDownloads, downloadableMedia);

    return {
      message,
      theme: selectTheme(global),
      isDownloading,
      canAutoLoadMedia: message ? selectCanAutoLoadMedia(global, message) : undefined,
      canAutoPlayMedia: message ? selectCanAutoPlayMedia(global, message) : undefined,
    };
  },
)(SponsoredMessage));
