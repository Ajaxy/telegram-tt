import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './StickerTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StickerTooltipAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const StickerTooltip = useModuleLoader(Bundles.Extra, 'StickerTooltip', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return StickerTooltip ? <StickerTooltip {...props} /> : undefined;
};

export default StickerTooltipAsync;
