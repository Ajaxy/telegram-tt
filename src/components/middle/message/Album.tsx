import { memo, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiMediaExtendedPreview, ApiMessage, ApiPhoto, ApiVideo,
} from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { IAlbum, ThemeKey } from '../../../types';

import {
  getIsDownloading, getMediaDimensions, getMessageContent, getMessageHtmlId, getMessagePhoto,
} from '../../../global/helpers';
import {
  selectActiveDownloads,
  selectCanAutoLoadMedia,
  selectCanAutoPlayMedia,
  selectTheme,
} from '../../../global/selectors';
import { getMessageKey } from '../../../util/keys/messageKey';
import { AlbumRectPart, calculateAlbumLayout } from './helpers/calculateAlbumLayout';
import withSelectControl from './hocs/withSelectControl';

import useLastCallback from '../../../hooks/useLastCallback';

import AlbumItem from './AlbumItem';
import Photo from './Photo';
import Video from './Video';

import './Album.scss';

const PhotoWithSelect = withSelectControl(Photo);
const VideoWithSelect = withSelectControl(Video);

type OwnProps = {
  album: IAlbum;
  observeIntersection: ObserveFn;
  hasCustomAppendix?: boolean;
  isOwn: boolean;
  isProtected?: boolean;
  onMediaClick: (messageId: number, index?: number) => void;
};

type StateProps = {
  theme: ThemeKey;
  uploadsByKey: GlobalState['fileUploads']['byMessageKey'];
  activeDownloads: TabState['activeDownloads'];
};

const Album = ({
  album,
  observeIntersection,
  hasCustomAppendix,
  isOwn,
  isProtected,
  onMediaClick,
  uploadsByKey,
  activeDownloads,
  theme,
}: OwnProps & StateProps) => {
  const { cancelUploadMedia } = getActions();

  const { content: { paidMedia } } = album.mainMessage;

  const mediaCount = album.isPaidMedia ? paidMedia!.extendedMedia.length : album.messages.length;

  const handlePaidMediaClick = useLastCallback((index: number) => {
    onMediaClick(album.mainMessage.id, index);
  });

  const handleAlbumMessageClick = useLastCallback((messageId: number) => {
    onMediaClick(messageId);
  });

  const handleCancelUpload = useLastCallback((messageId: number) => {
    cancelUploadMedia({ chatId: album.mainMessage.chatId, messageId });
  });

  const messages = useMemo(() => {
    if (album.isPaidMedia) {
      return album.mainMessage.content.paidMedia!.extendedMedia.map(() => album.mainMessage);
    }

    return album.messages;
  }, [album]);

  const albumLayout = useMemo(() => {
    const ratios = getAlbumMedia(album).map((media) => {
      const { width, height } = getMediaDimensions(media);
      return width / height;
    });

    return calculateAlbumLayout(ratios);
  }, [album]);

  function renderAlbumMessage(message: ApiMessage, index: number) {
    const renderingPaidMedia = album.isPaidMedia ? message.content.paidMedia?.extendedMedia[index] : undefined;
    const paidPhotoOrPreview = renderingPaidMedia && 'mediaType' in renderingPaidMedia
      ? renderingPaidMedia : renderingPaidMedia?.photo;
    const paidVideoOrPreview = renderingPaidMedia && 'mediaType' in renderingPaidMedia
      ? renderingPaidMedia : renderingPaidMedia?.video;
    const photo = paidPhotoOrPreview || getMessagePhoto(message);
    const video = paidVideoOrPreview || getMessageContent(message).video;

    const fileUpload = uploadsByKey[getMessageKey(message)];
    const uploadProgress = fileUpload?.progress;
    const layoutItem = albumLayout.items[index];
    const { sides } = layoutItem;

    // Ignoring global updates is a known drawback here
    const canAutoLoad = selectCanAutoLoadMedia(getGlobal(), message);
    const canAutoPlay = selectCanAutoPlayMedia(getGlobal(), message);
    let mediaElement;

    if (photo) {
      const shouldAffectAppendix = hasCustomAppendix && (

        (isOwn ? index === mediaCount - 1 : Boolean(sides & AlbumRectPart.Left && sides & AlbumRectPart.Bottom))
      );

      mediaElement = (
        <PhotoWithSelect
          id={`album-media-${getMessageHtmlId(message.id, album.isPaidMedia ? index : undefined)}`}
          photo={photo}
          isOwn={isOwn}
          observeIntersection={observeIntersection}
          canAutoLoad={canAutoLoad}
          shouldAffectAppendix={shouldAffectAppendix}
          uploadProgress={uploadProgress}
          layout="fill"
          isProtected={isProtected}
          clickArg={album.isPaidMedia ? index : message.id}
          onClick={album.isPaidMedia ? handlePaidMediaClick : handleAlbumMessageClick}
          onCancelUpload={handleCancelUpload}
          isDownloading={photo.mediaType !== 'extendedMediaPreview' && getIsDownloading(activeDownloads, photo)}
          theme={theme}
          noSelectControls={album.isPaidMedia}
        />
      );
    } else if (video) {
      mediaElement = (
        <VideoWithSelect
          id={`album-media-${getMessageHtmlId(message.id, album.isPaidMedia ? index : undefined)}`}
          video={video}
          observeIntersectionForLoading={observeIntersection}
          canAutoLoad={canAutoLoad}
          canAutoPlay={canAutoPlay}
          uploadProgress={uploadProgress}
          layout="fill"
          isProtected={isProtected}
          clickArg={album.isPaidMedia ? index : message.id}
          onClick={album.isPaidMedia ? handlePaidMediaClick : handleAlbumMessageClick}
          onCancelUpload={handleCancelUpload}
          isDownloading={video.mediaType !== 'extendedMediaPreview' && getIsDownloading(activeDownloads, video)}
          noSelectControls={album.isPaidMedia}
        />
      );
    }

    if (!mediaElement) return undefined;

    return (
      <AlbumItem
        key={album.isPaidMedia ? index : message.id}
        item={layoutItem}
        className="album-item"
      >
        {mediaElement}
      </AlbumItem>
    );
  }

  return (
    <div
      className="Album"
      style={`--album-aspect-ratio: ${albumLayout.aspectRatio}`}
    >
      {messages.map(renderAlbumMessage)}
    </div>
  );
};

type AlbumMedia = ApiPhoto | ApiVideo | ApiMediaExtendedPreview;

function getAlbumMedia(album: IAlbum) {
  const media = album.isPaidMedia
    ? album.mainMessage.content.paidMedia!.extendedMedia.map((item) => (
      'mediaType' in item ? item : (item.photo || item.video)
    ))
    : album.messages.map((message) => getMessagePhoto(message) || getMessageContent(message).video);

  return media.filter((item): item is AlbumMedia => Boolean(item));
}

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const theme = selectTheme(global);
    const activeDownloads = selectActiveDownloads(global);

    return {
      theme,
      uploadsByKey: global.fileUploads.byMessageKey,
      activeDownloads,
    };
  },
)(Album));
