import type { OwnProps } from './StickerTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const StickerTooltipAsync = (props: OwnProps) => {
  const StickerTooltip = useModuleLoader(Bundles.Extra, 'StickerTooltip');

  return StickerTooltip ? <StickerTooltip {...props} /> : undefined;
};

export default StickerTooltipAsync;
