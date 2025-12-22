import type { ElementRef, FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiSponsoredMessage } from '../../../api/types';
import type { ThemeKey } from '../../../types';
import { MediaViewerOrigin } from '../../../types';

import {
  getIsDownloading,
  getMessageContent,
} from '../../../global/helpers';
import {
  selectActiveDownloads, selectCanAutoLoadMedia, selectCanAutoPlayMedia,
  selectSponsoredMessage,
  selectTheme,
} from '../../../global/selectors';
import { selectMessageDownloadableMedia } from '../../../global/selectors/media';
import { IS_ANDROID } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';
import { preventMessageInputBlur } from '../helpers/preventMessageInputBlur';
import { calculateMediaDimensions, getMinMediaWidth, getMinMediaWidthWithText } from './helpers/mediaDimensions';

import useAppLayout from '../../../hooks/useAppLayout';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import { type ObserveFn, useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Avatar from '../../common/Avatar';
import BadgeButton from '../../common/BadgeButton';
import PeerColorWrapper from '../../common/PeerColorWrapper';
import Button from '../../ui/Button';
import MessageAppendix from './MessageAppendix';
import Photo from './Photo';
import SponsoredContextMenuContainer from './SponsoredContextMenuContainer.async';
import Video from './Video';

import './SponsoredMessage.scss';

type OwnProps = {
  chatId: string;
  containerRef: ElementRef<HTMLDivElement>;
  observeIntersectionForLoading: ObserveFn;
  observeIntersectionForPlaying: ObserveFn;
};

type StateProps = {
  message?: ApiSponsoredMessage;
  theme: ThemeKey;
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
    viewSponsored,
    openUrl,
    hideSponsored,
    clickSponsored,
    openMediaViewer,
    openAboutAdsModal,
  } = getActions();

  const lang = useOldLang();
  const contentRef = useRef<HTMLDivElement>();
  const ref = useRef<HTMLDivElement>();
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
      if (target.isIntersecting && message?.randomId) {
        viewSponsored({ randomId: message.randomId });
      }
    }) : undefined;
  }, [message?.randomId, shouldObserve, observeIntersection, viewSponsored]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    preventMessageInputBlur(e);
    handleBeforeContextMenu(e);
  };

  const handleHideSponsoredMessage = useLastCallback(() => {
    hideSponsored();
  });

  const content = message && getMessageContent(message);
  const {
    photo, video, text,
  } = content || {};

  const isGif = video?.isGif;
  const hasMedia = Boolean(photo || video);

  const handleClick = useLastCallback(() => {
    if (!message) return;

    clickSponsored({ randomId: message.randomId, isMedia: photo || isGif ? true : undefined });
    openUrl({ url: message.url, shouldSkipModal: true });
  });

  const handleOpenMedia = useLastCallback(() => {
    if (!message) return;
    clickSponsored({ randomId: message.randomId, isMedia: true });
    openMediaViewer({
      origin: MediaViewerOrigin.SponsoredMessage,
      chatId,
      isSponsoredMessage: true,
    });
  });

  const handleOpenAboutAdsModal = useLastCallback(() => {
    if (!message) return;
    openAboutAdsModal({
      randomId: message.randomId,
      canReport: message.canReport,
      additionalInfo: message.additionalInfo,
      sponsorInfo: message.sponsorInfo,
    });
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
        if (width < getMinMediaWidthWithText(isMobile)) {
          contentWidth = width;
        }
        calculatedWidth = Math.max(getMinMediaWidth(text?.text, isMobile), width);
      }
    }

    if (calculatedWidth) {
      style = `width: ${calculatedWidth + extraPadding}px`;
    }

    return {
      contentWidth, noMediaCorners, style,
    };
  }, [photo, video, isMobile, text?.text]);

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
            {message.isRecommended ? lang('Message.RecommendedLabel') : lang('SponsoredMessage')}
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
            iconName="close"
            iconClassName="sponsored-action-icon"
            ariaLabel={lang('Close')}
            onClick={handleHideSponsoredMessage}
          />
          {message.canReport && (
            <Button
              className="message-action-button"
              color="translucent-white"
              round
              iconName="more"
              iconClassName="sponsored-action-icon"
              ariaLabel={lang('More')}
              onClick={handleContextMenu}
              onContextMenu={handleContextMenu}
            />
          )}
        </div>
      </div>
      {contextMenuAnchor && (
        <SponsoredContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          triggerRef={ref}
          randomId={message.randomId}
          canReport={message.canReport}
          sponsorInfo={message.sponsorInfo}
          additionalInfo={message.additionalInfo}
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const message = selectSponsoredMessage(global, chatId);

    const activeDownloads = selectActiveDownloads(global);
    const downloadableMedia = message ? selectMessageDownloadableMedia(global, message) : undefined;
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
