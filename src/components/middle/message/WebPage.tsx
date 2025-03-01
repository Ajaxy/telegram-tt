import type { FC } from '../../../lib/teact/teact';
import React, { memo, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiMessage, ApiTypeStory } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { AudioOrigin, type ISettings } from '../../../types';

import { getMessageWebPage } from '../../../global/helpers';
import { selectCanPlayAnimatedEmojis } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { tryParseDeepLink } from '../../../util/deepLinkParser';
import trimText from '../../../util/trimText';
import renderText from '../../common/helpers/renderText';
import { calculateMediaDimensions } from './helpers/mediaDimensions';
import { getWebpageButtonLangKey } from './helpers/webpageType';

import useDynamicColorListener from '../../../hooks/stickers/useDynamicColorListener';
import useAppLayout from '../../../hooks/useAppLayout';
import useEnsureStory from '../../../hooks/useEnsureStory';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import Audio from '../../common/Audio';
import Document from '../../common/Document';
import EmojiIconBackground from '../../common/embedded/EmojiIconBackground';
import PeerColorWrapper from '../../common/PeerColorWrapper';
import SafeLink from '../../common/SafeLink';
import StickerView from '../../common/StickerView';
import Button from '../../ui/Button';
import BaseStory from './BaseStory';
import Photo from './Photo';
import Video from './Video';
import WebPageUniqueGift from './WebPageUniqueGift';

import './WebPage.scss';

const MAX_TEXT_LENGTH = 170; // symbols
const WEBPAGE_STORY_TYPE = 'telegram_story';
const WEBPAGE_GIFT_TYPE = 'telegram_nft';
const STICKER_SIZE = 80;
const EMOJI_SIZE = 38;

type OwnProps = {
  message: ApiMessage;
  noAvatars?: boolean;
  canAutoLoad?: boolean;
  canAutoPlay?: boolean;
  inPreview?: boolean;
  asForwarded?: boolean;
  isDownloading?: boolean;
  isProtected?: boolean;
  isConnected?: boolean;
  backgroundEmojiId?: string;
  theme: ISettings['theme'];
  story?: ApiTypeStory;
  shouldWarnAboutSvg?: boolean;
  autoLoadFileMaxSizeMb?: number;
  lastPlaybackTimestamp?: number;
  isEditing?: boolean;
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
  message,
  noAvatars,
  canAutoLoad,
  canAutoPlay,
  inPreview,
  asForwarded,
  isDownloading = false,
  isProtected,
  isConnected,
  story,
  theme,
  backgroundEmojiId,
  shouldWarnAboutSvg,
  autoLoadFileMaxSizeMb,
  lastPlaybackTimestamp,
  isEditing,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onMediaClick,
  onDocumentClick,
  onContainerClick,
  onAudioPlay,
  onCancelMediaTransfer,
}) => {
  const { openUrl, openTelegramLink } = getActions();
  const webPage = getMessageWebPage(message);
  const { isMobile } = useAppLayout();
  // eslint-disable-next-line no-null/no-null
  const stickersRef = useRef<HTMLDivElement>(null);

  const oldLang = useOldLang();
  const lang = useLang();

  const handleMediaClick = useLastCallback(() => {
    onMediaClick!();
  });

  const handleContainerClick = useLastCallback((e: React.MouseEvent) => {
    onContainerClick?.(e);
  });

  const handleOpenTelegramLink = useLastCallback(() => {
    if (!webPage) return;

    openTelegramLink({
      url: webPage.url,
    });
  });

  const { story: storyData, stickers } = webPage || {};

  useEnsureStory(storyData?.peerId, storyData?.id, story);

  const hasCustomColor = stickers?.isWithTextColor || stickers?.documents?.[0]?.shouldUseTextColor;
  const customColor = useDynamicColorListener(stickersRef, undefined, !hasCustomColor);

  const linkTimestamp = useMemo(() => {
    const parsedLink = webPage?.url && tryParseDeepLink(webPage?.url);
    if (!parsedLink || !('timestamp' in parsedLink)) return undefined;
    return parsedLink.timestamp;
  }, [webPage?.url]);

  if (!webPage) {
    return undefined;
  }

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
    mediaSize,
  } = webPage;
  const isStory = type === WEBPAGE_STORY_TYPE;
  const isGift = type === WEBPAGE_GIFT_TYPE;
  const isExpiredStory = story && 'isDeleted' in story;

  const quickButtonLangKey = !inPreview && !isExpiredStory ? getWebpageButtonLangKey(type) : undefined;
  const quickButtonTitle = quickButtonLangKey && lang(quickButtonLangKey);

  const truncatedDescription = trimText(description, MAX_TEXT_LENGTH);
  const isArticle = Boolean(truncatedDescription || title || siteName);
  let isSquarePhoto = Boolean(stickers);
  if (isArticle && webPage?.photo && !webPage.video && !webPage.document) {
    const { width, height } = calculateMediaDimensions({
      media: webPage.photo,
      isOwn: message.isOutgoing,
      isInWebPage: true,
      asForwarded,
      noAvatars,
      isMobile,
    });
    isSquarePhoto = (width === height || mediaSize === 'small') && mediaSize !== 'large';
  }
  const isMediaInteractive = (photo || video) && onMediaClick && !isSquarePhoto;

  const className = buildClassName(
    'WebPage',
    inPreview && 'in-preview',
    !isEditing && inPreview && 'interactive',
    isSquarePhoto && 'with-square-photo',
    !photo && !video && !inPreview && 'without-media',
    video && 'with-video',
    !isArticle && 'no-article',
    document && 'with-document',
    quickButtonTitle && 'with-quick-button',
    isGift && 'with-gift',
  );

  function renderQuickButton(caption: string) {
    return (
      <Button
        className="WebPage--quick-button"
        size="tiny"
        color="translucent"
        isRectangular
        noForcedUpperCase
        onClick={handleOpenTelegramLink}
      >
        {caption}
      </Button>
    );
  }

  return (
    <PeerColorWrapper
      className={className}
      data-initial={(siteName || displayUrl)[0]}
      dir={oldLang.isRtl ? 'rtl' : 'auto'}
      onClick={handleContainerClick}
    >
      <div className={buildClassName(
        'WebPage--content',
        isStory && 'is-story',
        isGift && 'is-gift',
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
        {isGift && !inPreview && (
          <WebPageUniqueGift
            gift={webPage.gift!}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            onClick={handleOpenTelegramLink}
          />
        )}
        {isArticle && (
          <div
            className={buildClassName('WebPage-text', !inPreview && 'WebPage-text_interactive')}
            onClick={!inPreview ? () => openUrl({ url, shouldSkipModal: true }) : undefined}
          >
            <SafeLink className="site-name" url={url} text={siteName || displayUrl} />
            {(!inPreview || isGift) && title && (
              <p className="site-title">{renderText(title)}</p>
            )}
            {truncatedDescription && !isGift && (
              <p className="site-description">{renderText(truncatedDescription, ['emoji', 'br'])}</p>
            )}
          </div>
        )}
        {photo && !isGift && !video && !document && (
          <Photo
            photo={photo}
            isOwn={message.isOutgoing}
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
        {!inPreview && video && (
          <Video
            video={video}
            isOwn={message.isOutgoing}
            isInWebPage
            observeIntersectionForLoading={observeIntersectionForLoading!}
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
        {!inPreview && audio && (
          <Audio
            theme={theme}
            message={message}
            origin={AudioOrigin.Inline}
            noAvatars={noAvatars}
            isDownloading={isDownloading}
            onPlay={onAudioPlay}
            onCancelUpload={onCancelMediaTransfer}
          />
        )}
        {!inPreview && document && (
          <Document
            document={document}
            message={message}
            observeIntersection={observeIntersectionForLoading}
            autoLoadFileMaxSizeMb={autoLoadFileMaxSizeMb}
            onMediaClick={onDocumentClick}
            onCancelUpload={onCancelMediaTransfer}
            isDownloading={isDownloading}
            shouldWarnAboutSvg={shouldWarnAboutSvg}
          />
        )}
        {!inPreview && stickers && (
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
        {inPreview && displayUrl && !isArticle && (
          <div className="WebPage-text">
            <p className="site-name">{displayUrl}</p>
            <p className="site-description">{oldLang('Chat.Empty.LinkPreview')}</p>
          </div>
        )}
      </div>
      {quickButtonTitle && renderQuickButton(quickButtonTitle)}
    </PeerColorWrapper>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
    };
  },
)(WebPage));
