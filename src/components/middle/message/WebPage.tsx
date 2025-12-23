import type { FC } from '../../../lib/teact/teact';
import type React from '../../../lib/teact/teact';
import { memo, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage, ApiMessageWebPage, ApiTypeStory, ApiWebPage, ApiWebPageFull } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { AudioOrigin, type ThemeKey, type WebPageMediaSize } from '../../../types';

import { getPhotoFullDimensions } from '../../../global/helpers';
import { selectCanPlayAnimatedEmojis } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { tryParseDeepLink } from '../../../util/deepLinkParser';
import trimText from '../../../util/trimText';
import renderText from '../../common/helpers/renderText';
import { getWebpageButtonIcon, getWebpageButtonLangKey } from './helpers/webpageType';

import useDynamicColorListener from '../../../hooks/stickers/useDynamicColorListener';
import useEnsureStory from '../../../hooks/useEnsureStory';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Audio from '../../common/Audio';
import Document from '../../common/Document';
import EmojiIconBackground from '../../common/embedded/EmojiIconBackground';
import Icon from '../../common/icons/Icon';
import PeerColorWrapper from '../../common/PeerColorWrapper';
import SafeLink from '../../common/SafeLink';
import StickerView from '../../common/StickerView';
import Button from '../../ui/Button';
import BaseStory from './BaseStory';
import Photo from './Photo';
import Video from './Video';
import WebPageStarGiftAuction from './WebPageStarGiftAuction';
import WebPageUniqueGift from './WebPageUniqueGift';

import './WebPage.scss';

const MAX_TEXT_LENGTH = 170; // symbols
const WEBPAGE_STORY_TYPE = 'telegram_story';
const WEBPAGE_GIFT_TYPE = 'telegram_nft';
const WEBPAGE_AUCTION_TYPE = 'telegram_auction';
const STICKER_SIZE = 80;
const EMOJI_SIZE = 38;

type OwnProps = {
  messageWebPage: ApiMessageWebPage;
  webPage: ApiWebPage;
  message?: ApiMessage;
  noAvatars?: boolean;
  canAutoLoad?: boolean;
  canAutoPlay?: boolean;
  asForwarded?: boolean;
  isDownloading?: boolean;
  isProtected?: boolean;
  isConnected?: boolean;
  backgroundEmojiId?: string;
  theme: ThemeKey;
  story?: ApiTypeStory;
  shouldWarnAboutFiles?: boolean;
  autoLoadFileMaxSizeMb?: number;
  lastPlaybackTimestamp?: number;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  onAudioPlay?: NoneToVoidFunction;
  onMediaClick?: NoneToVoidFunction;
  onDocumentClick?: NoneToVoidFunction;
  onCancelMediaTransfer?: NoneToVoidFunction;
  onContainerClick?: ((e: React.MouseEvent) => void);
};
type StateProps = {
  canPlayAnimatedEmojis: boolean;
};

const WebPage: FC<OwnProps & StateProps> = ({
  messageWebPage,
  webPage,
  message,
  noAvatars,
  canAutoLoad,
  canAutoPlay,
  asForwarded,
  isDownloading = false,
  isProtected,
  isConnected,
  story,
  theme,
  backgroundEmojiId,
  shouldWarnAboutFiles,
  autoLoadFileMaxSizeMb,
  lastPlaybackTimestamp,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onMediaClick,
  onDocumentClick,
  onContainerClick,
  onAudioPlay,
  onCancelMediaTransfer,
}) => {
  const { openUrl, openTelegramLink } = getActions();
  const stickersRef = useRef<HTMLDivElement>();

  const lang = useLang();

  const handleMediaClick = useLastCallback(() => {
    onMediaClick!();
  });

  const handleContainerClick = useLastCallback((e: React.MouseEvent) => {
    onContainerClick?.(e);
  });

  const fullWebPage = webPage?.webpageType === 'full' ? webPage : undefined;

  const { story: storyData, stickers } = fullWebPage || {};

  useEnsureStory(storyData?.peerId, storyData?.id, story);

  const hasCustomColor = stickers?.isWithTextColor || stickers?.documents?.[0]?.shouldUseTextColor;
  const customColor = useDynamicColorListener(stickersRef, undefined, !hasCustomColor);

  const linkTimestamp = useMemo(() => {
    const parsedLink = webPage?.url && tryParseDeepLink(webPage?.url);
    if (!parsedLink || !('timestamp' in parsedLink)) return undefined;
    return parsedLink.timestamp;
  }, [webPage?.url]);

  if (webPage?.webpageType !== 'full') return undefined;

  const handleOpenTelegramLink = useLastCallback(() => {
    openTelegramLink({
      url: webPage.url,
    });
  });

  const {
    siteName,
    url,
    displayUrl,
    title,
    description,
    photo,
    video,
    audio,
    type,
    document,
  } = webPage;
  const { mediaSize } = messageWebPage;
  const isStory = type === WEBPAGE_STORY_TYPE;
  const isGift = type === WEBPAGE_GIFT_TYPE;
  const isAuction = type === WEBPAGE_AUCTION_TYPE;
  const isExpiredStory = story && 'isDeleted' in story;

  const resultType = stickers?.isEmoji ? 'telegram_emojiset' : type;
  const auctionEndDate = isAuction && webPage.auction ? webPage.auction.endDate : undefined;
  const quickButtonLangKey = !isExpiredStory ? getWebpageButtonLangKey(resultType, auctionEndDate) : undefined;
  const quickButtonTitle = quickButtonLangKey && lang(quickButtonLangKey);
  const quickButtonIcon = getWebpageButtonIcon(resultType);

  const truncatedDescription = trimText(description, MAX_TEXT_LENGTH);
  const isArticle = Boolean(truncatedDescription || title || siteName);
  let isSquarePhoto = Boolean(stickers);
  if (isArticle && webPage?.photo && !webPage.video && !webPage.document) {
    isSquarePhoto = getIsSmallPhoto(webPage, mediaSize);
  }
  const isMediaInteractive = (photo || video) && onMediaClick && !isSquarePhoto;

  const className = buildClassName(
    'WebPage',
    isSquarePhoto && 'with-square-photo',
    !photo && !video && 'without-media',
    video && 'with-video',
    !isArticle && 'no-article',
    document && 'with-document',
    quickButtonTitle && 'with-quick-button',
    (isGift || isAuction) && 'with-gift',
  );

  function renderQuickButton() {
    return (
      <Button
        className="WebPage--quick-button"
        size="tiny"
        color="translucent"
        isRectangular
        noForcedUpperCase={!isAuction}
        onClick={handleOpenTelegramLink}
      >
        {quickButtonIcon && <Icon name={quickButtonIcon} />}
        {quickButtonTitle}
      </Button>
    );
  }

  return (
    <PeerColorWrapper
      className={className}
      data-initial={(siteName || displayUrl)[0]}
      dir={lang.isRtl ? 'rtl' : 'auto'}
      onClick={handleContainerClick}
    >
      <div className={buildClassName(
        'WebPage--content',
        isStory && 'is-story',
        (isGift || isAuction) && 'is-gift',
      )}
      >
        {backgroundEmojiId && (
          <EmojiIconBackground
            emojiDocumentId={backgroundEmojiId}
            className="WebPage--background-icons"
          />
        )}
        {isStory && (
          <BaseStory story={story} isProtected={isProtected} isConnected={isConnected} isPreview />
        )}
        {isGift && (
          <WebPageUniqueGift
            gift={webPage.gift!}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            onClick={handleOpenTelegramLink}
          />
        )}
        {isAuction && webPage.auction && (
          <WebPageStarGiftAuction
            auction={webPage.auction}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            onClick={handleOpenTelegramLink}
          />
        )}
        {isArticle && (
          <div
            className={buildClassName('WebPage-text', 'WebPage-text_interactive')}
            onClick={() => openUrl({ url, shouldSkipModal: messageWebPage.isSafe })}
          >
            <SafeLink className="site-name" url={url} text={siteName || displayUrl} />
            {title && (
              <p className="site-title">{renderText(title)}</p>
            )}
            {truncatedDescription && !isGift && !isAuction && (
              <p className="site-description">{renderText(truncatedDescription, ['emoji', 'br'])}</p>
            )}
          </div>
        )}
        {photo && !isGift && !isAuction && !video && !document && (
          <Photo
            photo={photo}
            isOwn={message?.isOutgoing}
            isInWebPage
            observeIntersection={observeIntersectionForLoading}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoad}
            size={isSquarePhoto ? 'pictogram' : 'inline'}
            asForwarded={asForwarded}
            nonInteractive={!isMediaInteractive}
            isDownloading={isDownloading}
            isProtected={isProtected}
            theme={theme}
            onClick={isMediaInteractive ? handleMediaClick : undefined}
            onCancelUpload={onCancelMediaTransfer}
          />
        )}
        {video && (
          <Video
            video={video}
            isOwn={message?.isOutgoing}
            isInWebPage
            observeIntersectionForLoading={observeIntersectionForLoading}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoad}
            canAutoPlay={canAutoPlay}
            asForwarded={asForwarded}
            isDownloading={isDownloading}
            isProtected={isProtected}
            lastPlaybackTimestamp={lastPlaybackTimestamp || linkTimestamp}
            onClick={isMediaInteractive ? handleMediaClick : undefined}
            onCancelUpload={onCancelMediaTransfer}
          />
        )}
        {audio && (
          <Audio
            theme={theme}
            message={message!}
            origin={AudioOrigin.Inline}
            noAvatars={noAvatars}
            isDownloading={isDownloading}
            onPlay={onAudioPlay}
            onCancelUpload={onCancelMediaTransfer}
          />
        )}
        {document && (
          <Document
            document={document}
            message={message}
            observeIntersection={observeIntersectionForLoading}
            autoLoadFileMaxSizeMb={autoLoadFileMaxSizeMb}
            onMediaClick={onDocumentClick}
            onCancelUpload={onCancelMediaTransfer}
            isDownloading={isDownloading}
            shouldWarnAboutFiles={shouldWarnAboutFiles}
          />
        )}
        {stickers && (
          <div
            ref={stickersRef}
            className={buildClassName(
              'media-inner', 'square-image', stickers.isEmoji && 'WebPage--emoji-grid', 'WebPage--stickers',
            )}
          >
            {stickers.documents.map((sticker) => (
              <div key={sticker.id} className="WebPage--sticker">
                <StickerView
                  containerRef={stickersRef}
                  sticker={sticker}
                  shouldLoop
                  size={stickers.isEmoji ? EMOJI_SIZE : STICKER_SIZE}
                  customColor={customColor}
                  observeIntersectionForPlaying={observeIntersectionForPlaying}
                  observeIntersectionForLoading={observeIntersectionForLoading}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      {quickButtonTitle && renderQuickButton()}
    </PeerColorWrapper>
  );
};

function getIsSmallPhoto(webPage: ApiWebPageFull, mediaSize?: WebPageMediaSize) {
  if (!webPage?.photo) return false;
  if (mediaSize === 'small') return true;
  if (mediaSize === 'large') return false;

  const { width, height } = getPhotoFullDimensions(webPage.photo) || {};
  if (!width || !height) return false;

  return width === height && !webPage.hasLargeMedia;
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
    };
  },
)(WebPage));
