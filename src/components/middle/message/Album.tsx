import React, { FC, useCallback } from '../../../lib/teact/teact';

import { GlobalState } from '../../../global/types';
import { ApiMessage } from '../../../api/types';
import { IAlbum, ISettings } from '../../../types';
import { AlbumRectPart, IAlbumLayout } from './helpers/calculateAlbumLayout';

import { getMessageContent } from '../../../modules/helpers';
import { getDispatch, getGlobal, withGlobal } from '../../../lib/teact/teactn';
import withSelectControl from './hocs/withSelectControl';
import { ObserveFn } from '../../../hooks/useIntersectionObserver';
import {
  selectActiveDownloadIds,
  selectCanAutoLoadMedia,
  selectCanAutoPlayMedia,
  selectTheme,
} from '../../../modules/selectors';

import Photo from './Photo';
import Video from './Video';

import './Album.scss';

const PhotoWithSelect = withSelectControl(Photo);
const VideoWithSelect = withSelectControl(Video);

type OwnProps = {
  album: IAlbum;
  observeIntersection: ObserveFn;
  hasCustomAppendix?: boolean;
  lastSyncTime?: number;
  isOwn: boolean;
  albumLayout: IAlbumLayout;
  onMediaClick: (messageId: number) => void;
};

type StateProps = {
  theme: ISettings['theme'];
  uploadsById: GlobalState['fileUploads']['byMessageLocalId'];
  activeDownloadIds: number[];
};

const Album: FC<OwnProps & StateProps> = ({
  album,
  observeIntersection,
  hasCustomAppendix,
  lastSyncTime,
  isOwn,
  albumLayout,
  onMediaClick,
  uploadsById,
  activeDownloadIds,
  theme,
}) => {
  const { cancelSendingMessage } = getDispatch();

  const mediaCount = album.messages.length;

  const handleCancelUpload = useCallback((message: ApiMessage) => {
    cancelSendingMessage({ chatId: message.chatId, messageId: message.id });
  }, [cancelSendingMessage]);

  function renderAlbumMessage(message: ApiMessage, index: number) {
    const { photo, video } = getMessageContent(message);
    const fileUpload = uploadsById[message.previousLocalId || message.id];
    const uploadProgress = fileUpload?.progress;
    const { dimensions, sides } = albumLayout.layout[index];

    // Ignoring global updates is a known drawback here
    const canAutoLoad = selectCanAutoLoadMedia(getGlobal(), message);
    const canAutoPlay = selectCanAutoPlayMedia(getGlobal(), message);

    if (photo) {
      const shouldAffectAppendix = hasCustomAppendix && (
        // eslint-disable-next-line no-bitwise
        (isOwn ? index === mediaCount - 1 : Boolean(sides & AlbumRectPart.Left && sides & AlbumRectPart.Bottom))
      );

      return (
        <PhotoWithSelect
          id={`album-media-${message.id}`}
          message={message}
          observeIntersection={observeIntersection}
          canAutoLoad={canAutoLoad}
          shouldAffectAppendix={shouldAffectAppendix}
          uploadProgress={uploadProgress}
          dimensions={dimensions}
          onClick={onMediaClick}
          onCancelUpload={handleCancelUpload}
          isDownloading={activeDownloadIds.includes(message.id)}
          theme={theme}
        />
      );
    } else if (video) {
      return (
        <VideoWithSelect
          id={`album-media-${message.id}`}
          message={message}
          observeIntersection={observeIntersection}
          canAutoLoad={canAutoLoad}
          canAutoPlay={canAutoPlay}
          uploadProgress={uploadProgress}
          lastSyncTime={lastSyncTime}
          dimensions={dimensions}
          onClick={onMediaClick}
          onCancelUpload={handleCancelUpload}
          isDownloading={activeDownloadIds.includes(message.id)}
          theme={theme}
        />
      );
    }

    return undefined;
  }

  const { width: containerWidth, height: containerHeight } = albumLayout.containerStyle;

  return (
    <div
      className="Album"
      // @ts-ignore
      style={`width: ${containerWidth}px; height: ${containerHeight}px;`}
    >
      {album.messages.map(renderAlbumMessage)}
    </div>
  );
};

export default withGlobal<OwnProps>(
  (global, { album }): StateProps => {
    const { chatId } = album.mainMessage;
    const theme = selectTheme(global);
    const activeDownloadIds = selectActiveDownloadIds(global, chatId);
    return {
      theme,
      uploadsById: global.fileUploads.byMessageLocalId,
      activeDownloadIds,
    };
  },
)(Album);
