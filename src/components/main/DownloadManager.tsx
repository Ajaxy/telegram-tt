import type { FC } from '../../lib/teact/teact';
import { memo, useEffect } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiMessage } from '../../api/types';
import type { GlobalState, TabState } from '../../global/types';
import { ApiMediaFormat } from '../../api/types';

import {
  getMessageContentFilename, getMessageMediaFormat, getMessageMediaHash,
} from '../../global/helpers';
import { selectTabState } from '../../global/selectors';
import download from '../../util/download';
import { compact } from '../../util/iteratees';
import * as mediaLoader from '../../util/mediaLoader';
import { IS_OPFS_SUPPORTED, IS_SERVICE_WORKER_SUPPORTED, MAX_BUFFER_SIZE } from '../../util/windowEnvironment';

import useLastCallback from '../../hooks/useLastCallback';
import useRunDebounced from '../../hooks/useRunDebounced';

type StateProps = {
  activeDownloads: TabState['activeDownloads']['byChatId'];
  messages?: GlobalState['messages']['byChatId'];
};

const GLOBAL_UPDATE_DEBOUNCE = 1000;

const processedMessages = new Set<ApiMessage>();
const downloadedMessages = new Set<ApiMessage>();

const DownloadManager: FC<StateProps> = ({
  activeDownloads,
}) => {
  const { cancelMessagesMediaDownload, showNotification } = getActions();

  const runDebounced = useRunDebounced(GLOBAL_UPDATE_DEBOUNCE, true);

  const handleMessageDownloaded = useLastCallback((message: ApiMessage) => {
    downloadedMessages.add(message);
    runDebounced(() => {
      if (downloadedMessages.size) {
        cancelMessagesMediaDownload({ messages: Array.from(downloadedMessages) });
        downloadedMessages.clear();
      }
    });
  });

  useEffect(() => {
    // No need for expensive global updates on messages, so we avoid them
    const messages = getGlobal().messages.byChatId;
    const scheduledMessages = getGlobal().scheduledMessages.byChatId;

    const activeMessages = Object.entries(activeDownloads).map(([chatId, chatActiveDownloads]) => {
      const chatMessages = chatActiveDownloads.ids?.map((id) => messages[chatId]?.byId[id]);
      const chatScheduledMessages = chatActiveDownloads.scheduledIds?.map((id) => scheduledMessages[chatId]?.byId[id]);

      return compact([...chatMessages || [], ...chatScheduledMessages || []]);
    }).flat();

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
  }, [activeDownloads, cancelMessagesMediaDownload, handleMessageDownloaded, showNotification]);

  return undefined;
};

export default memo(withGlobal(
  (global): StateProps => {
    const activeDownloads = selectTabState(global).activeDownloads.byChatId;

    return {
      activeDownloads,
    };
  },
)(DownloadManager));
