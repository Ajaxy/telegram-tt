import React, { FC, memo } from '../../../lib/teact/teact';
import { OwnProps } from './InlineBotTooltip';
import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const InlineBotTooltipAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const InlineBotTooltip = useModuleLoader(Bundles.Extra, 'InlineBotTooltip', !isOpen);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return InlineBotTooltip ? <InlineBotTooltip {...props} /> : undefined;
};

export default memo(InlineBotTooltipAsync);
