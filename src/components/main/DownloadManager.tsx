import { FC, memo, useEffect } from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../modules';

import { Thread } from '../../global/types';
import { ApiMediaFormat, ApiMessage } from '../../api/types';

import * as mediaLoader from '../../util/mediaLoader';
import download from '../../util/download';
import {
  getMessageContentFilename, getMessageMediaHash,
} from '../../modules/helpers';

type StateProps = {
  activeDownloads: Record<number, number[]>;
  messages: Record<number, {
    byId: Record<number, ApiMessage>;
    threadsById: Record<number, Thread>;
  }>;
};

const startedDownloads = new Set<string>();

const DownloadManager: FC<StateProps> = ({
  activeDownloads,
  messages,
}) => {
  const { cancelMessageMediaDownload } = getDispatch();

  useEffect(() => {
    Object.entries(activeDownloads).forEach(([chatId, messageIds]) => {
      const activeMessages = messageIds.map((id) => messages[Number(chatId)].byId[id]);
      activeMessages.forEach((message) => {
        const downloadHash = getMessageMediaHash(message, 'download');
        if (!downloadHash) {
          cancelMessageMediaDownload({ message });
          return;
        }

        if (!startedDownloads.has(downloadHash)) {
          const mediaData = mediaLoader.getFromMemory(downloadHash);
          if (mediaData) {
            startedDownloads.delete(downloadHash);
            download(mediaData, getMessageContentFilename(message));
            cancelMessageMediaDownload({ message });
            return;
          }

          mediaLoader.fetch(downloadHash, ApiMediaFormat.BlobUrl, true).then((result) => {
            startedDownloads.delete(downloadHash);
            if (result) {
              download(result, getMessageContentFilename(message));
            }
            cancelMessageMediaDownload({ message });
          });

          startedDownloads.add(downloadHash);
        }
      });
    });
  }, [
    cancelMessageMediaDownload,
    messages,
    activeDownloads,
  ]);

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
