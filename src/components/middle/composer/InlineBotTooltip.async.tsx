import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './InlineBotTooltip';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const InlineBotTooltipAsync: FC<OwnProps> = (props) => {
  const { isOpen } = props;
  const InlineBotTooltip = useModuleLoader(Bundles.Extra, 'InlineBotTooltip', !isOpen);

  return InlineBotTooltip ? <InlineBotTooltip {...props} /> : undefined;
};

export default InlineBotTooltipAsync;
