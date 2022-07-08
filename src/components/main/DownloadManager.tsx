import type { FC } from '../../lib/teact/teact';
import { memo, useCallback, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { Thread } from '../../global/types';
import type { ApiMessage } from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import * as mediaLoader from '../../util/mediaLoader';
import download from '../../util/download';
import {
  getMessageContentFilename, getMessageMediaHash,
} from '../../global/helpers';

import useRunDebounced from '../../hooks/useRunDebounced';

type StateProps = {
  activeDownloads: Record<string, number[]>;
  messages: Record<string, {
    byId: Record<number, ApiMessage>;
    threadsById: Record<number, Thread>;
  }>;
};

const GLOBAL_UPDATE_DEBOUNCE = 1000;

const MAX_BLOB_SIZE = 0x7FFFFFFF - 1;

const processedMessages = new Set<ApiMessage>();
const downloadedMessages = new Set<ApiMessage>();

const DownloadManager: FC<StateProps> = ({
  activeDownloads,
  messages,
}) => {
  const { cancelMessagesMediaDownload, showNotification } = getActions();

  const runDebounced = useRunDebounced(GLOBAL_UPDATE_DEBOUNCE, true);

  const handleMessageDownloaded = useCallback((message: ApiMessage) => {
    downloadedMessages.add(message);
    runDebounced(() => {
      if (downloadedMessages.size) {
        cancelMessagesMediaDownload({ messages: Array.from(downloadedMessages) });
        downloadedMessages.clear();
      }
    });
  }, [cancelMessagesMediaDownload, runDebounced]);

  useEffect(() => {
    const activeMessages = Object.entries(activeDownloads).map(([chatId, messageIds]) => (
      messageIds.map((id) => messages[chatId].byId[id])
    )).flat();

    if (!activeMessages.length) {
      processedMessages.clear();
      return;
    }

    activeMessages.forEach((message) => {
      if (processedMessages.has(message)) {
        return;
      }
      processedMessages.add(message);
      const downloadHash = getMessageMediaHash(message, 'download');
      if (!downloadHash) {
        handleMessageDownloaded(message);
        return;
      }

      const mediaData = mediaLoader.getFromMemory(downloadHash);

      if (mediaData) {
        download(mediaData, getMessageContentFilename(message));
        handleMessageDownloaded(message);
        return;
      }

      const {
        document, video, audio,
      } = message.content;
      const mediaSize = (document || video || audio)?.size || 0;
      if (mediaSize > MAX_BLOB_SIZE) {
        showNotification({
          // eslint-disable-next-line max-len
          message: 'Downloading files bigger than 2GB currently unsupported due to browser limitations. We are working on fixing this issue as soon as possible.',
        });
        handleMessageDownloaded(message);
        return;
      }

      mediaLoader.fetch(downloadHash, ApiMediaFormat.BlobUrl, true).then((result) => {
        if (result) {
          download(result, getMessageContentFilename(message));
        }
        handleMessageDownloaded(message);
      });
    });
  }, [messages, activeDownloads, cancelMessagesMediaDownload, handleMessageDownloaded, showNotification]);

  return undefined;
};

export default memo(withGlobal(
  (global): StateProps => {
    const activeDownloads = global.activeDownloads.byChatId;
    const messages = global.messages.byChatId;
    return {
      activeDownloads,
      messages,
    };
  },
)(DownloadManager));
