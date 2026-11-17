import { memo } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiMessage } from '../../../api/types';
import type {
  ActiveDownloads, PlaybackSource, ThemeKey, ThreadId,
} from '../../../types';

import { getIsDownloading, getMessageContent, getRichMediaMessage } from '../../../global/helpers';
import {
  selectActiveDownloads, selectChatMessage, selectIsChatProtected, selectTheme,
} from '../../../global/selectors';

import Audio from '../../common/Audio';

type OwnProps = {
  chatId: string;
  messageId: number;
  mediaIndex?: number;
  threadId?: ThreadId;
  playbackSource: PlaybackSource;
  onPlay: (messageId: number, chatId: string, documentId?: string) => void;
};

type StateProps = {
  message?: ApiMessage;
  theme: ThemeKey;
  activeDownloads: ActiveDownloads;
  isChatProtected?: boolean;
};

const PlaylistTrack = ({
  mediaIndex,
  threadId,
  playbackSource,
  message,
  theme,
  activeDownloads,
  isChatProtected,
  onPlay,
}: OwnProps & StateProps) => {
  if (!message) {
    return undefined;
  }

  const { audio } = getMessageContent(message);

  return (
    <Audio
      theme={theme}
      message={message}
      mediaIndex={mediaIndex}
      variant="sharedMedia"
      threadId={threadId}
      playbackSource={playbackSource}
      noProgress
      withPlayingRing
      onPlay={onPlay}
      canDownload={!isChatProtected && !message.isProtected}
      isDownloading={Boolean(audio && getIsDownloading(activeDownloads, audio))}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId, messageId, mediaIndex }): Complete<StateProps> => {
    const message = selectChatMessage(global, chatId, messageId);

    return {
      message: message?.content.richMessage && mediaIndex !== undefined
        ? getRichMediaMessage(message, mediaIndex)
        : message,
      theme: selectTheme(global),
      activeDownloads: selectActiveDownloads(global),
      isChatProtected: selectIsChatProtected(global, chatId),
    };
  },
)(PlaylistTrack));
