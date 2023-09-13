import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './CustomEmojiTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const CustomEmojiTooltipAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const CustomEmojiTooltip = useModuleLoader(Bundles.Extra, 'CustomEmojiTooltip', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return CustomEmojiTooltip ? <CustomEmojiTooltip {...props} /> : undefined;
};

export default CustomEmojiTooltipAsync;
