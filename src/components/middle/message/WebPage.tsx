import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiMessage, ApiTypeStory } from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import { AudioOrigin, type ISettings } from '../../../types';

import { getMessageWebPage } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import trimText from '../../../util/trimText';
import renderText from '../../common/helpers/renderText';
import { calculateMediaDimensions } from './helpers/mediaDimensions';
import { getWebpageButtonText } from './helpers/webpageType';

import useAppLayout from '../../../hooks/useAppLayout';
import useEnsureStory from '../../../hooks/useEnsureStory';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Audio from '../../common/Audio';
import Document from '../../common/Document';
import EmojiIconBackground from '../../common/embedded/EmojiIconBackground';
import SafeLink from '../../common/SafeLink';
import Button from '../../ui/Button';
import BaseStory from './BaseStory';
import Photo from './Photo';
import Video from './Video';

import './WebPage.scss';

const MAX_TEXT_LENGTH = 170; // symbols
const WEBPAGE_STORY_TYPE = 'telegram_story';

type OwnProps = {
  message: ApiMessage;
  observeIntersection?: ObserveFn;
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
  onAudioPlay?: NoneToVoidFunction;
  onMediaClick?: NoneToVoidFunction;
  onCancelMediaTransfer?: NoneToVoidFunction;
};

const WebPage: FC<OwnProps> = ({
  message,
  observeIntersection,
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
  onMediaClick,
  onAudioPlay,
  onCancelMediaTransfer,
}) => {
  const { openTelegramLink } = getActions();
  const webPage = getMessageWebPage(message);
  const { isMobile } = useAppLayout();

  const lang = useLang();

  const handleMediaClick = useLastCallback(() => {
    onMediaClick!();
  });

  const handleQuickButtonClick = useLastCallback(() => {
    if (!webPage) return;
    openTelegramLink({
      url: webPage.url,
    });
  });

  const { story: storyData } = webPage || {};

  useEnsureStory(storyData?.peerId, storyData?.id, story);

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
  } = webPage;
  const isStory = type === WEBPAGE_STORY_TYPE;
  const isExpiredStory = story && 'isDeleted' in story;
  const quickButtonLangKey = !inPreview && !isExpiredStory ? getWebpageButtonText(type) : undefined;
  const truncatedDescription = trimText(description, MAX_TEXT_LENGTH);
  const isArticle = Boolean(truncatedDescription || title || siteName);
  let isSquarePhoto = false;
  if (isArticle && webPage?.photo && !webPage.video) {
    const { width, height } = calculateMediaDimensions(message, undefined, undefined, isMobile);
    isSquarePhoto = width === height;
  }
  const isMediaInteractive = (photo || video) && onMediaClick && !isSquarePhoto;

  const className = buildClassName(
    'WebPage',
    inPreview && 'in-preview',
    isSquarePhoto && 'with-square-photo',
    !photo && !video && !inPreview && 'without-media',
    video && 'with-video',
    !isArticle && 'no-article',
    document && 'with-document',
    quickButtonLangKey && 'with-quick-button',
  );

  function renderQuickButton(langKey: string) {
    return (
      <Button
        className="WebPage--quick-button"
        size="tiny"
        color="translucent"
        isRectangular
        onClick={handleQuickButtonClick}
      >
        {lang(langKey)}
      </Button>
    );
  }

  return (
    <div
      className={className}
      data-initial={(siteName || displayUrl)[0]}
      dir={lang.isRtl ? 'rtl' : 'auto'}
    >
      <div className={buildClassName('WebPage--content', isStory && 'is-story')}>
        {isStory && (
          <BaseStory story={story} isProtected={isProtected} isConnected={isConnected} isPreview />
        )}
        {photo && !video && (
          <Photo
            message={message}
            observeIntersection={observeIntersection}
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
        {isArticle && (
          <div className="WebPage-text">
            {backgroundEmojiId && (
              <EmojiIconBackground
                emojiDocumentId={backgroundEmojiId}
                className="WebPage--background-icons"
              />
            )}
            <SafeLink className="site-name" url={url} text={siteName || displayUrl} />
            {!inPreview && title && (
              <p className="site-title">{renderText(title)}</p>
            )}
            {truncatedDescription && (
              <p className="site-description">{renderText(truncatedDescription, ['emoji', 'br'])}</p>
            )}
          </div>
        )}
        {!inPreview && video && (
          <Video
            message={message}
            observeIntersectionForLoading={observeIntersection!}
            noAvatars={noAvatars}
            canAutoLoad={canAutoLoad}
            canAutoPlay={canAutoPlay}
            asForwarded={asForwarded}
            isDownloading={isDownloading}
            isProtected={isProtected}
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
            message={message}
            observeIntersection={observeIntersection}
            autoLoadFileMaxSizeMb={autoLoadFileMaxSizeMb}
            onMediaClick={handleMediaClick}
            onCancelUpload={onCancelMediaTransfer}
            isDownloading={isDownloading}
            shouldWarnAboutSvg={shouldWarnAboutSvg}
          />
        )}
        {inPreview && displayUrl && !isArticle && (
          <div className="WebPage-text">
            {backgroundEmojiId && (
              <EmojiIconBackground
                emojiDocumentId={backgroundEmojiId}
                className="WebPage--background-icons"
              />
            )}
            <p className="site-name">{displayUrl}</p>
            <p className="site-description">{lang('Chat.Empty.LinkPreview')}</p>
          </div>
        )}
      </div>
      {quickButtonLangKey && renderQuickButton(quickButtonLangKey)}
    </div>
  );
};

export default memo(WebPage);
