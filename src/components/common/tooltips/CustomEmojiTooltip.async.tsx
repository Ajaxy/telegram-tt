import type { OwnProps } from './CustomEmojiTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const CustomEmojiTooltipAsync = (props: OwnProps) => {
  const CustomEmojiTooltip = useModuleLoader(Bundles.Extra, 'CustomEmojiTooltip');

  return CustomEmojiTooltip ? <CustomEmojiTooltip {...props} /> : undefined;
};

export default CustomEmojiTooltipAsync;
