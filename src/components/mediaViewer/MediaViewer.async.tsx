import type { FC } from '../../lib/teact/teact';
import React from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

interface OwnProps {
  isOpen: boolean;
}

const MediaViewerAsync: FC<OwnProps> = ({ isOpen }) => {
  const MediaViewer = useModuleLoader(Bundles.Extra, 'MediaViewer', !isOpen);

  return MediaViewer ? <MediaViewer /> : undefined;
};

export default MediaViewerAsync;
