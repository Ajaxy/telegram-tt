import React, { FC, useCallback } from '../../../lib/teact/teact';

import { GlobalActions, GlobalState } from '../../../global/types';
import { ApiMessage } from '../../../api/types';
import { IAlbum } from '../../../types';
import { AlbumRectPart, IAlbumLayout } from './helpers/calculateAlbumLayout';

import { getMessageContent } from '../../../modules/helpers';
import { withGlobal } from '../../../lib/teact/teactn';
import { pick } from '../../../util/iteratees';
import withSelectControl from './hocs/withSelectControl';
import { ObserveFn } from '../../../hooks/useIntersectionObserver';

import Photo from './Photo';
import Video from './Video';

import './Album.scss';

const PhotoWithSelect = withSelectControl(Photo);
const VideoWithSelect = withSelectControl(Video);

type OwnProps = {
  album: IAlbum;
  observeIntersection: ObserveFn;
  shouldAutoLoad?: boolean;
  shouldAutoPlay?: boolean;
  hasCustomAppendix?: boolean;
  lastSyncTime?: number;
  isOwn: boolean;
  albumLayout: IAlbumLayout;
  onMediaClick: (messageId: number) => void;
};

type StateProps = {
  uploadsById: GlobalState['fileUploads']['byMessageLocalId'];
};

type DispatchProps = Pick<GlobalActions, 'cancelSendingMessage'>;

const Album: FC<OwnProps & StateProps & DispatchProps> = ({
  album,
  observeIntersection,
  shouldAutoLoad,
  shouldAutoPlay,
  hasCustomAppendix,
  lastSyncTime,
  isOwn,
  albumLayout,
  onMediaClick,
  uploadsById,
  cancelSendingMessage,
}) => {
  const mediaCount = album.messages.length;

  const handleCancelUpload = useCallback((message: ApiMessage) => {
    cancelSendingMessage({ chatId: message.chatId, messageId: message.id });
  }, [cancelSendingMessage]);

  function renderAlbumMessage(message: ApiMessage, index: number) {
    const { photo, video } = getMessageContent(message);
    const fileUpload = uploadsById[message.previousLocalId || message.id];
    const uploadProgress = fileUpload ? fileUpload.progress : undefined;
    const { dimensions, sides } = albumLayout.layout[index];

    if (photo) {
      const shouldAffectAppendix = hasCustomAppendix && (
        // eslint-disable-next-line no-bitwise
        isOwn ? index === mediaCount - 1 : Boolean(sides & AlbumRectPart.Left && sides & AlbumRectPart.Bottom)
      );

      return (
        <PhotoWithSelect
          id={`album-media-${message.id}`}
          message={message}
          observeIntersection={observeIntersection}
          shouldAutoLoad={shouldAutoLoad}
          shouldAffectAppendix={shouldAffectAppendix}
          uploadProgress={uploadProgress}
          dimensions={dimensions}
          onClick={onMediaClick}
          onCancelUpload={handleCancelUpload}
        />
      );
    } else if (video) {
      return (
        <VideoWithSelect
          id={`album-media-${message.id}`}
          message={message}
          observeIntersection={observeIntersection}
          shouldAutoLoad={shouldAutoLoad}
          shouldAutoPlay={shouldAutoPlay}
          uploadProgress={uploadProgress}
          lastSyncTime={lastSyncTime}
          dimensions={dimensions}
          onClick={onMediaClick}
          onCancelUpload={handleCancelUpload}
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
  (global): StateProps => {
    return {
      uploadsById: global.fileUploads.byMessageLocalId,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'cancelSendingMessage',
  ]),
)(Album);
