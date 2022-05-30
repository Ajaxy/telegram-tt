import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import type { OwnProps } from './BotCommandTooltip';
import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const BotCommandTooltipAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const BotCommandTooltip = useModuleLoader(Bundles.Extra, 'BotCommandTooltip', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return BotCommandTooltip ? <BotCommandTooltip {...props} /> : undefined;
};

export default memo(BotCommandTooltipAsync);
