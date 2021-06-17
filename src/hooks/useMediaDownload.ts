import React, { useCallback, useEffect, useState } from '../lib/teact/teact';

import useMediaWithDownloadProgress from './useMediaWithDownloadProgress';
import download from '../util/download';

export default function useMediaDownload(
  mediaHash?: string,
  fileName?: string,
) {
  const [isDownloadStarted, setIsDownloadStarted] = useState(false);

  const { mediaData, downloadProgress } = useMediaWithDownloadProgress(mediaHash, !isDownloadStarted);

  // Download with browser when fully loaded
  useEffect(() => {
    if (isDownloadStarted && mediaData) {
      download(mediaData, fileName!);
      setIsDownloadStarted(false);
    }
  }, [fileName, mediaData, isDownloadStarted]);

  // Cancel download on source change
  useEffect(() => {
    setIsDownloadStarted(false);
  }, [mediaHash]);

  const handleDownloadClick = useCallback((e: React.SyntheticEvent<HTMLElement>) => {
    e.stopPropagation();
    setIsDownloadStarted((isAllowed) => !isAllowed);
  }, []);

  return {
    isDownloadStarted,
    downloadProgress,
    handleDownloadClick,
  };
}
