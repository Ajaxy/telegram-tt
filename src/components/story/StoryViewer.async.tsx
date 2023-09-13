import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import { Bundles } from '../../util/moduleLoader';

import useModuleLoader from '../../hooks/useModuleLoader';

interface OwnProps {
  isOpen: boolean;
}

const StoryViewerAsync: FC<OwnProps> = ({ isOpen }) => {
  const StoryViewer = useModuleLoader(Bundles.Extra, 'StoryViewer', !isOpen);

  return StoryViewer ? <StoryViewer /> : undefined;
};

export default memo(StoryViewerAsync);
