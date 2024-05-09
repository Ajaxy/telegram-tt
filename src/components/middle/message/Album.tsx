import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type { GlobalState } from '../../../global/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { IAlbum, ISettings } from '../../../types';
import type { IAlbumLayout } from './helpers/calculateAlbumLayout';

import { getMessageContent, getMessageHtmlId } from '../../../global/helpers';
import {
  selectActiveDownloads,
  selectCanAutoLoadMedia,
  selectCanAutoPlayMedia,
  selectTheme,
} from '../../../global/selectors';
import { getMessageKey } from '../../../util/messageKey';
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
  onMediaClick: (messageId: number) => void;
};

type StateProps = {
  theme: ISettings['theme'];
  uploadsByKey: GlobalState['fileUploads']['byMessageKey'];
  activeDownloadIds?: number[];
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
  activeDownloadIds,
  theme,
}) => {
  const { cancelUploadMedia } = getActions();

  const mediaCount = album.messages.length;

  const handleCancelUpload = useLastCallback((message: ApiMessage) => {
    cancelUploadMedia({ chatId: message.chatId, messageId: message.id });
  });

  function renderAlbumMessage(message: ApiMessage, index: number) {
    const { photo, video } = getMessageContent(message);
    const fileUpload = uploadsByKey[getMessageKey(message)];
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
          id={`album-media-${getMessageHtmlId(message.id)}`}
          message={message}
          observeIntersectionForLoading={observeIntersection}
          canAutoLoad={canAutoLoad}
          shouldAffectAppendix={shouldAffectAppendix}
          uploadProgress={uploadProgress}
          dimensions={dimensions}
          isProtected={isProtected}
          onClick={onMediaClick}
          onCancelUpload={handleCancelUpload}
          isDownloading={activeDownloadIds?.includes(message.id)}
          theme={theme}
        />
      );
    } else if (video) {
      return (
        <VideoWithSelect
          id={`album-media-${getMessageHtmlId(message.id)}`}
          message={message}
          observeIntersectionForLoading={observeIntersection}
          canAutoLoad={canAutoLoad}
          canAutoPlay={canAutoPlay}
          uploadProgress={uploadProgress}
          dimensions={dimensions}
          isProtected={isProtected}
          onClick={onMediaClick}
          onCancelUpload={handleCancelUpload}
          isDownloading={activeDownloadIds?.includes(message.id)}
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
    const activeDownloads = selectActiveDownloads(global, chatId);
    const isScheduled = album.mainMessage.isScheduled;

    return {
      theme,
      uploadsByKey: global.fileUploads.byMessageKey,
      activeDownloadIds: isScheduled ? activeDownloads?.scheduledIds : activeDownloads?.ids,
    };
  },
)(Album);
