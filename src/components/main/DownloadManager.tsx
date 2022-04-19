import {
  FC, memo, useCallback, useEffect,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { Thread } from '../../global/types';
import { ApiMediaFormat, ApiMessage } from '../../api/types';

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

const processedMessages = new Set<ApiMessage>();
const downloadedMessages = new Set<ApiMessage>();

const DownloadManager: FC<StateProps> = ({
  activeDownloads,
  messages,
}) => {
  const { cancelMessagesMediaDownload } = getActions();

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

      mediaLoader.fetch(downloadHash, ApiMediaFormat.BlobUrl, true).then((result) => {
        if (result) {
          download(result, getMessageContentFilename(message));
        }
        handleMessageDownloaded(message);
      });
    });
  }, [messages, activeDownloads, cancelMessagesMediaDownload, handleMessageDownloaded]);

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
