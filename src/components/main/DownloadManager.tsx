import type { FC } from '../../lib/teact/teact';
import { memo, useCallback, useEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { Thread } from '../../global/types';
import type { ApiMessage } from '../../api/types';
import { ApiMediaFormat } from '../../api/types';

import { selectTabState } from '../../global/selectors';
import { IS_OPFS_SUPPORTED, IS_SERVICE_WORKER_SUPPORTED, MAX_BUFFER_SIZE } from '../../util/environment';
import * as mediaLoader from '../../util/mediaLoader';
import download from '../../util/download';
import {
  getMessageContentFilename, getMessageMediaFormat, getMessageMediaHash,
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
      if (mediaSize > MAX_BUFFER_SIZE && !IS_OPFS_SUPPORTED && !IS_SERVICE_WORKER_SUPPORTED) {
        showNotification({
          message: 'Downloading files bigger than 2GB is not supported in your browser.',
        });
        handleMessageDownloaded(message);
        return;
      }

      const mediaFormat = getMessageMediaFormat(message, 'download');
      mediaLoader.fetch(downloadHash, mediaFormat, true).then((result) => {
        if (mediaFormat === ApiMediaFormat.DownloadUrl) {
          const url = new URL(result, window.document.baseURI);
          const filename = getMessageContentFilename(message);
          url.searchParams.set('filename', encodeURIComponent(filename));
          const downloadWindow = window.open(url.toString());
          downloadWindow?.addEventListener('beforeunload', () => {
            showNotification({
              message: 'Download started. Please, do not close the app before it is finished.',
            });
          });
        } else if (result) {
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
    const activeDownloads = selectTabState(global).activeDownloads.byChatId;
    const messages = global.messages.byChatId;
    return {
      activeDownloads,
      messages,
    };
  },
)(DownloadManager));
