import type { FC } from '../../../lib/teact/teact';
import { useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { GlobalState, TabState } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { IAlbum, ThemeKey } from '../../../types';
import type { IAlbumLayout } from './helpers/calculateAlbumLayout';

import {
  getIsDownloading, getMessageContent, getMessageHtmlId, getMessagePhoto,
} from '../../../global/helpers';
import {
  selectActiveDownloads,
  selectCanAutoLoadMedia,
  selectCanAutoPlayMedia,
  selectTheme,
} from '../../../global/selectors';
import { getMessageKey } from '../../../util/keys/messageKey';
import { AlbumRectPart } from './helpers/calculateAlbumLayout';
import withSelectControl from './hocs/withSelectControl';

import useLastCallback from '../../../hooks/useLastCallback';

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
  albumLayout: IAlbumLayout;
  onMediaClick: (messageId: number, index?: number) => void;
};

type StateProps = {
  theme: ThemeKey;
  uploadsByKey: GlobalState['fileUploads']['byMessageKey'];
  activeDownloads: TabState['activeDownloads'];
};

const Album: FC<OwnProps & StateProps> = ({
  album,
  observeIntersection,
  hasCustomAppendix,
  isOwn,
  isProtected,
  albumLayout,
  onMediaClick,
  uploadsByKey,
  activeDownloads,
  theme,
}) => {
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
    const { dimensions, sides } = albumLayout.layout[index];

    // Ignoring global updates is a known drawback here
    const canAutoLoad = selectCanAutoLoadMedia(getGlobal(), message);
    const canAutoPlay = selectCanAutoPlayMedia(getGlobal(), message);

    if (photo) {
      const shouldAffectAppendix = hasCustomAppendix && (

        (isOwn ? index === mediaCount - 1 : Boolean(sides & AlbumRectPart.Left && sides & AlbumRectPart.Bottom))
      );

      return (
        <PhotoWithSelect
          id={`album-media-${getMessageHtmlId(message.id, album.isPaidMedia ? index : undefined)}`}
          photo={photo}
          isOwn={isOwn}
          observeIntersectionForLoading={observeIntersection}
          canAutoLoad={canAutoLoad}
          shouldAffectAppendix={shouldAffectAppendix}
          uploadProgress={uploadProgress}
          dimensions={dimensions}
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
      return (
        <VideoWithSelect
          id={`album-media-${getMessageHtmlId(message.id)}`}
          video={video}
          observeIntersectionForLoading={observeIntersection}
          canAutoLoad={canAutoLoad}
          canAutoPlay={canAutoPlay}
          uploadProgress={uploadProgress}
          dimensions={dimensions}
          isProtected={isProtected}
          clickArg={album.isPaidMedia ? index : message.id}
          onClick={album.isPaidMedia ? handlePaidMediaClick : handleAlbumMessageClick}
          onCancelUpload={handleCancelUpload}
          isDownloading={video.mediaType !== 'extendedMediaPreview' && getIsDownloading(activeDownloads, video)}
          theme={theme}
          noSelectControls={album.isPaidMedia}
        />
      );
    }

    return undefined;
  }

  const { width: containerWidth, height: containerHeight } = albumLayout.containerStyle;

  return (
    <div
      className="Album"
      style={`width: ${containerWidth}px; height: ${containerHeight}px;`}
    >
      {messages.map(renderAlbumMessage)}
    </div>
  );
};

export default withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const theme = selectTheme(global);
    const activeDownloads = selectActiveDownloads(global);

    return {
      theme,
      uploadsByKey: global.fileUploads.byMessageKey,
      activeDownloads,
    };
  },
)(Album);
